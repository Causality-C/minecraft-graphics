import {Mat3, Mat4, Quat, Vec3, Vec4} from '../lib/TSM.js';
import {Camera} from '../lib/webglutils/Camera.js';
import {CanvasAnimation, WebGLUtilities,} from '../lib/webglutils/CanvasAnimation.js';
import {Debugger} from '../lib/webglutils/Debugging.js';
import {RenderPass} from '../lib/webglutils/RenderPass.js';

import {Chunk} from './Chunk.js';
import {Cube} from './Cube.js';
import {GUI, Portal} from './Gui.js';
import {blankCubeFSText, blankCubeVSText, blankPortalFSText, blankPortalVSText} from './Shaders.js';

export class Config {
  public static PLAYER_RADIUS: number = 0.4;

  public static PLAYER_HEIGHT: number = 2.0;

  public static CHUNK_SIZE: number = 64.0;

  // How far you can select a cube from the player
  public static SELECT_RADIUS: number = 3.0;

  // Number of chunks to render outside of the player's chunk
  // 1 --> 3 x 3, 2 -> 5 x 5, ... n -> 2n+1 x 2n+1
  public static BORDER_CHUNKS: number = 1.0;

  // Number of chunks to store in cache before resetting; for hysteresis
  public static CACHE_SIZE: number = (2 * Config.BORDER_CHUNKS + 1) ** 2;

  public static GRAVITY: number = -9.8;

  public static JUMP_VELOCITY: number = 10.0;

  public static DAY_TIME_SECONDS: number = 60.0;

  public static NIGHT_COLOR: Vec4 =
      new Vec4([0.04313725, 0.00392157, 0.14901961, 1.0]);

  public static DAY_COLOR: Vec4 =
      new Vec4([0.6784314, 0.84705882, 0.90196078, 1.0]);

  public static CREATIVE_MODE: boolean = false;

  public static PERLIN_3D: boolean = false;
}

export class MinecraftAnimation extends CanvasAnimation {
  private gui: GUI;

  chunks: {};
  cache: {};
  chunk: Chunk;

  /*  Cube Rendering */
  private cubeGeometry: Cube;
  private blankCubeRenderPass: RenderPass;

  /* Cube Selection */
  private selectedCubeF32: Float32Array;
  private highlightSelected: boolean;
  public highlightOn: boolean;
  private removeCube: boolean;
  private modificationLog: number[][];

  /* Global Rendering Info */
  private lightPosition: Vec4;
  private backgroundColor: Vec4;

  private canvas2d: HTMLCanvasElement;

  // Player's head position in world coordinate.
  // Player should extend two units down from this location, and 0.4 units
  // radially.
  private playerPosition: Vec3;
  private onGround: boolean;
  private verticalVelocity: Vec3;
  private gravityTime: number;
  private frameTime: number;

  /* Portal Rendering Info */
  private portalRenderPass: RenderPass;
  private portals: Portal[];
  private portalBuffer: Uint8Array;
  private portalPerspectiveRP: RenderPass;
  private secondBuffer: WebGLFramebuffer;
  public portalOutletCamera: Camera;
  private portalInputCamera: Camera;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);

    this.canvas2d = document.getElementById('textCanvas') as HTMLCanvasElement;

    this.ctx = Debugger.makeDebugContext(this.ctx);
    let gl = this.ctx;

    this.gui = new GUI(this.canvas2d, this);
    this.playerPosition = this.gui.getCamera().pos();
    this.verticalVelocity = new Vec3();
    this.gravityTime = Date.now();
    this.frameTime = Date.now();

    // Generate initial landscape
    this.chunks = {};
    this.cache = {};

    this.blankCubeRenderPass =
        new RenderPass(gl, blankCubeVSText, blankCubeFSText);
    this.cubeGeometry = new Cube();
    this.initBlankCube(this.blankCubeRenderPass, this.gui.getCamera());

    this.lightPosition = new Vec4([-1000, 1000, -1000, 1]);
    this.backgroundColor = new Vec4([0.0, 0.37254903, 0.37254903, 1.0]);
    this.highlightSelected = false;
    this.highlightOn = false;
    this.modificationLog = [];

    // Portals: use their own renderpass, should probably have their own
    // collsion logic
    this.portals = [];
    this.portalRenderPass =
        new RenderPass(gl, blankPortalVSText, blankPortalFSText);
    this.portalBuffer =
        new Uint8Array(4 * gl.drawingBufferHeight * gl.drawingBufferWidth);
    this.initPortal(this.portalRenderPass, this.gui.getCamera());


    // This is the portal perspective render pass: we should probably lower the
    // resolution
    this.portalPerspectiveRP =
        new RenderPass(gl, blankCubeVSText, blankCubeFSText);

    // These are arbitrary values but useful for debugging
    let pos: Vec3 = new Vec3([-26.598791122436523, 68.5, -12.321470260620117]);
    // this means we are looking out on the +z axis
    let look: Vec3 = new Vec3([0.0, 0.0, -1.0]);
    let up: Vec3 = new Vec3([0.0, 1.0, 0.0]);

    this.portalOutletCamera = new Camera(
        pos, Vec3.sum(pos, look), up, 45,
        gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 1000.0);

    this.initBlankCube(this.portalPerspectiveRP, this.portalOutletCamera);

    // Allocate another frame buffer
    this.secondBuffer = this.createFrameBuffer(
        gl, gl.drawingBufferWidth, gl.drawingBufferHeight);

    // Reset so things work
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private createFrameBuffer(
      gl: WebGLRenderingContext, width: number,
      height: number): WebGLFramebuffer {
    const offscreenFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenFBO);

    const renderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
    gl.renderbufferStorage(
        gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
    gl.framebufferRenderbuffer(
        gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);

    // Create and bind a color buffer for the color attachment
    const colorBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, colorBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA4, width, height);
    gl.framebufferRenderbuffer(
        gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, colorBuffer);
    return offscreenFBO as WebGLFramebuffer;
  }

  private chunkKey(x: number, z: number): string {
    return `${Math.round(x)}_${Math.round(z)}`;
  }

  private generateChunks() {
    let centerX = Math.floor(
                      (this.playerPosition.x + Config.CHUNK_SIZE / 2) /
                      Config.CHUNK_SIZE) *
        Config.CHUNK_SIZE;
    let centerZ = Math.floor(
                      (this.playerPosition.z + Config.CHUNK_SIZE / 2) /
                      Config.CHUNK_SIZE) *
        Config.CHUNK_SIZE;

    let xCoords: number[] = [];
    let zCoords: number[] = [];

    for (let i = -Config.BORDER_CHUNKS; i <= Config.BORDER_CHUNKS; i++) {
      for (let j = -Config.BORDER_CHUNKS; j <= Config.BORDER_CHUNKS; j++) {
        xCoords.push(centerX + Config.CHUNK_SIZE * i);
        zCoords.push(centerZ + Config.CHUNK_SIZE * j);
      }
    }

    let newChunks = {};
    for (let i = 0; i < (1 + 2 * Config.BORDER_CHUNKS) ** 2; i++) {
      const key = this.chunkKey(xCoords[i], zCoords[i]);
      if (key in this.chunks) {
        newChunks[key] = this.chunks[key];
      } else if (key in this.cache) {
        newChunks[key] = this.cache[key];
      } else {
        newChunks[key] = new Chunk(xCoords[i], zCoords[i], Config.CHUNK_SIZE);

        // When loading chunks, we need to update the chunk's state based on
        // modified blocks
        newChunks[key].updateFromLog(this.modificationLog);
      }
      if (i == Math.floor(((1 + 2 * Config.BORDER_CHUNKS) ** 2) / 2)) {
        this.chunk = newChunks[key];
      }
    }

    // Cache deleted chunks for hysteresis logic
    if (Object.keys(this.cache).length > Config.CACHE_SIZE) {
      this.cache = {}
    }
    for (let key in this.chunks) {
      if (!(key in newChunks)) {
        this.cache[key] = this.chunks[key]
      }
    }
    this.chunks = newChunks;
  }

  private collisionChunks(cameraLocation: Vec3): Chunk[] {
    let candidates: Chunk[] = [];
    candidates.push(this.chunk);
    const center: Vec3 = this.chunk.getChunkCenter();
    const xMod = Math.abs(
        Math.abs(cameraLocation.x) % Config.CHUNK_SIZE - Config.CHUNK_SIZE / 2);
    const zMod = Math.abs(
        Math.abs(cameraLocation.z) % Config.CHUNK_SIZE - Config.CHUNK_SIZE / 2);
    if (xMod <= 2.0) {
      candidates.push(
          this.chunks[this.chunkKey(center.x + Config.CHUNK_SIZE, center.z)]);
      candidates.push(
          this.chunks[this.chunkKey(center.x - Config.CHUNK_SIZE, center.z)]);
    }
    if (zMod <= 2.0) {
      candidates.push(
          this.chunks[this.chunkKey(center.x, center.z + Config.CHUNK_SIZE)]);
      candidates.push(
          this.chunks[this.chunkKey(center.x, center.z - Config.CHUNK_SIZE)]);
    }
    if (xMod <= 2.0 && zMod <= 2.0) {
      candidates.push(this.chunks[this.chunkKey(
          center.x + Config.CHUNK_SIZE, center.z + Config.CHUNK_SIZE)]);
      candidates.push(this.chunks[this.chunkKey(
          center.x - Config.CHUNK_SIZE, center.z + Config.CHUNK_SIZE)]);
      candidates.push(this.chunks[this.chunkKey(
          center.x + Config.CHUNK_SIZE, center.z - Config.CHUNK_SIZE)]);
      candidates.push(this.chunks[this.chunkKey(
          center.x - Config.CHUNK_SIZE, center.z - Config.CHUNK_SIZE)]);
    }
    return candidates;
  }

  /**
   * Setup the simulation. This can be called again to reset the program.
   */
  public reset(): void {
    this.gui.reset();
    this.playerPosition = this.gui.getCamera().pos();
  }

  /**
   * Sets up the blank cube drawing for a given perspective
   */
  private initBlankCube(renderPass: RenderPass, perspective: Camera): void {
    renderPass.setIndexBufferData(this.cubeGeometry.indicesFlat());
    renderPass.addAttribute(
        'aVertPos', 4, this.ctx.FLOAT, false,
        4 * Float32Array.BYTES_PER_ELEMENT, 0, undefined,
        this.cubeGeometry.positionsFlat());

    renderPass.addAttribute(
        'aNorm', 4, this.ctx.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT,
        0, undefined, this.cubeGeometry.normalsFlat());

    renderPass.addAttribute(
        'aUV', 2, this.ctx.FLOAT, false, 2 * Float32Array.BYTES_PER_ELEMENT, 0,
        undefined, this.cubeGeometry.uvFlat());

    renderPass.addInstancedAttribute(
        'aOffset', 4, this.ctx.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT,
        0, undefined, new Float32Array(0));

    renderPass.addUniform(
        'uLightPos', (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
          gl.uniform4fv(loc, this.lightPosition.xyzw);
        });
    renderPass.addUniform(
        'uProj', (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
          gl.uniformMatrix4fv(
              loc, false, new Float32Array(perspective.projMatrix().all()));
        });
    renderPass.addUniform(
        'uView', (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
          gl.uniformMatrix4fv(
              loc, false, new Float32Array(perspective.viewMatrix().all()));
        });
    renderPass.addUniform(
        'uTime', (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
          gl.uniform1f(loc, (Date.now() / 500.0) % (2 * Math.PI));
        });

    renderPass.setDrawData(
        this.ctx.TRIANGLES, this.cubeGeometry.indicesFlat().length,
        this.ctx.UNSIGNED_INT, 0);
    renderPass.setup();
  }

  private initPortal(portalRenderPass: RenderPass, perspective: Camera): void {
    // These are the indices we'll use for the cube vertices
    portalRenderPass.setIndexBufferData(this.cubeGeometry.indicesFlat());
    portalRenderPass.addAttribute(
        'aVertPos', 4, this.ctx.FLOAT, false,
        4 * Float32Array.BYTES_PER_ELEMENT, 0, undefined,
        this.cubeGeometry.positionsFlat());

    portalRenderPass.addAttribute(
        'aNorm', 4, this.ctx.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT,
        0, undefined, this.cubeGeometry.normalsFlat());

    portalRenderPass.addAttribute(
        'aUV', 2, this.ctx.FLOAT, false, 2 * Float32Array.BYTES_PER_ELEMENT, 0,
        undefined, this.cubeGeometry.uvFlat());

    // For this render pass howm any cubes are we going to draw
    portalRenderPass.addInstancedAttribute(
        'aOffset', 4, this.ctx.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT,
        0, undefined, new Float32Array(0));

    // Add world space light position
    portalRenderPass.addUniform(
        'uLightPos', (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
          gl.uniform4fv(loc, this.lightPosition.xyzw);
        });

    // Camera Matrices
    portalRenderPass.addUniform(
        'uProj', (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
          gl.uniformMatrix4fv(
              loc, false, new Float32Array(perspective.projMatrix().all()));
        });
    portalRenderPass.addUniform(
        'uView', (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
          gl.uniformMatrix4fv(
              loc, false, new Float32Array(perspective.viewMatrix().all()));
        });
    // Set up the texture location uniform
    portalRenderPass.addUniform(
        'uTexture', (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
          gl.uniform1i(loc, 0);
        });

    // Initialize the blocks draw information
    portalRenderPass.setDrawData(
        this.ctx.TRIANGLES, this.cubeGeometry.indicesFlat().length,
        this.ctx.UNSIGNED_INT, 0);

    portalRenderPass.setup();
  }

  /**
   * Draws a single frame
   *
   */
  public draw(): void {
    // TODO: Logic for a rudimentary walking simulator. Check for collisions and
    // reject attempts to walk into a cube. Handle gravity, jumping, and loading
    // of new chunks when necessary.
    this.generateChunks();
    if (!Config.CREATIVE_MODE) {
      let position: Vec3 = new Vec3(this.playerPosition.xyz);
      let chunks: Chunk[] = this.collisionChunks(this.playerPosition);
      position.add(this.gui.walkDir().scale(GUI.walkSpeed));
      if (!position.equals(this.playerPosition)) {
        let safe: boolean = true;
        for (let i = 0; i < chunks.length; i++) {
          if (chunks[i].sideCollision(position)) {
            this.playerPosition.x = Math.round(this.playerPosition.x);
            this.playerPosition.z = Math.round(this.playerPosition.z);
            safe = false;
            break;
          }
        }
        if (safe) {
          this.playerPosition = position;
        }
      }
      position = new Vec3(this.playerPosition.xyz);
      let velocity: Vec3 = new Vec3([
        0.0, Config.GRAVITY * (Date.now() - this.gravityTime) / 1000.0, 0.0
      ]);
      velocity.add(this.verticalVelocity);
      velocity.scale((Date.now() - this.frameTime) / 1000.0)
      position.add(velocity);
      this.frameTime = Date.now();
      let safe: boolean = true;
      for (let i = 0; i < chunks.length; i++) {
        let height = chunks[i].verticalCollision(position, velocity.y > 0);
        if (height != Number.MIN_SAFE_INTEGER) {
          this.playerPosition.y = height + Config.PLAYER_HEIGHT;
          this.onGround = true;
          this.verticalVelocity = new Vec3();
          this.gravityTime = Date.now();
          safe = false;
          break;
        }
      }
      if (safe) {
        this.onGround = false;
        this.playerPosition = position;
      }
      this.gui.getCamera().setPos(this.playerPosition);
    } else {
      this.playerPosition.add(this.gui.walkDir().scale(GUI.walkSpeed));
      this.gui.getCamera().setPos(this.playerPosition);
      this.gravityTime = Date.now();
    }

    // Portal Position and orientation logic
    if (this.portals.length !== 0 && this.portalInputCamera) {
      // Only try first portal for now
      let portal: Portal = this.portals[0];

      // Compute transformation matrix
      let outLocalToWorld: Mat4 = this.portalOutletCamera._init_view.copy();
      let inWorldToLocal: Mat4 = this.portalInputCamera._init_view.copy();
      let curLocalToWorld: Mat4 = this.gui.getCamera().viewMatrix().copy();
      curLocalToWorld.inverse();
      outLocalToWorld.inverse();

      // transform m = outLocalToWorld * inWorldToLocal * curLocalToWorld
      let m: Mat4 = Mat4.product(outLocalToWorld, inWorldToLocal);
      m = Mat4.product(m, curLocalToWorld);
      this.portalOutletCamera.setStaticTransformation(m);
    }

    // Day night logic
    let ellipseCenter: Vec4 =
        new Vec4([this.playerPosition.x, 0.0, this.playerPosition.z, 0.0]);
    let cycleTime: number =
        (Date.now() / ((Config.DAY_TIME_SECONDS / 60.0) * 10000.0)) %
        (2 * Math.PI);
    let sinT: number = Math.sin(cycleTime);
    let cosT: number = Math.cos(cycleTime);
    let curveVector: Vec4 =
        new Vec4([1000.0 * sinT, 1000.0 * cosT, 1000.0 * sinT, 1.0]);
    this.lightPosition = Vec4.sum(ellipseCenter, curveVector);
    let heightPercent: number =
        Math.max((this.lightPosition.y + 500.0) / 1500.0, 0.0);
    this.backgroundColor = Vec4.sum(
        Config.NIGHT_COLOR,
        Vec4.difference(Config.DAY_COLOR, Config.NIGHT_COLOR)
            .scale(heightPercent));
    this.backgroundColor.w = 1.0;

    // Drawing
    const gl: WebGLRenderingContext = this.ctx;
    const bg: Vec4 = this.backgroundColor;
    gl.clearColor(bg.r, bg.g, bg.b, bg.a);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.frontFace(gl.CCW);
    gl.cullFace(gl.BACK);

    // Scene is drawn
    this.drawScene(0, 0, 1280, 960);

    // Draw debug information
    let debugText: string = `Coords: (${this.playerPosition.xyz.map((x) => {
      return x.toFixed(2);
    })})`;
    let debugTextLook: string =
        `Look: (${this.gui.getCamera().forward().xyz.map((x) => {
          return x.toFixed(2);
        })})`;
    let debugTextUp: string = `Up: (${this.gui.getCamera().up().xyz.map((x) => {
      return x.toFixed(2);
    })})`;
    let debugTextBlock: string = `Block: ${this.gui.currentBlock}`
    let debugElement: HTMLElement =
        document.getElementById('coords') as HTMLElement;
    debugElement.innerHTML = debugText + '\n' + debugTextLook + '\n' +
        debugTextBlock + '\n' + debugTextUp;
  }
  private readTextureFromBuffer(
      gl: WebGLRenderingContext, width: number, height: number,
      dest: Uint8Array) {
    let texture = gl.createTexture();
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, dest);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        this.portalBuffer);
    // Clamp on horizontal and vertical and linearly interpolate
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  }

  private drawScene(x: number, y: number, width: number, height: number): void {
    const gl: WebGLRenderingContext = this.ctx;

    // Use an offscreen buffer to compute the portal's perspective
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.secondBuffer);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.viewport(x, y, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.frontFace(gl.CCW);
    gl.cullFace(gl.BACK);

    for (let chunk in this.chunks) {
      // Compute the render the portal's perspective also
      this.portalPerspectiveRP.updateAttributeBuffer(
          'aOffset', this.chunks[chunk].cubePositions());
      this.portalPerspectiveRP.drawInstanced(this.chunks[chunk].numCubes());
    }

    // Move portal's perspective to the buffer
    this.readTextureFromBuffer(gl, width, height, this.portalBuffer);

    // We do the computation and feed this texture into portals -- TODO: see
    // Now use default frame buffer to draw the scene
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    for (let chunk in this.chunks) {
      this.blankCubeRenderPass.updateAttributeBuffer(
          'aOffset', this.chunks[chunk].cubePositions());
      this.blankCubeRenderPass.drawInstanced(this.chunks[chunk].numCubes());
    }
    // We draw a sillouette of the selected cube on top of everything else.
    if (this.highlightSelected && this.highlightOn) {
      // Draw a portal sillouette if the player is in portal mode
      if (this.gui.currentBlock == 2) {
        this.selectedCubeF32[3] = 4.0;
      }
      this.blankCubeRenderPass.updateAttributeBuffer(
          'aOffset', this.selectedCubeF32);
      this.blankCubeRenderPass.drawInstanced(1);
    }


    // Now we draw the portals if they exist
    let portalPositions: number[] = [];
    if (this.portals.length !== 0) {
      this.portals[0].blocks.forEach((block: Vec3) => {
        portalPositions.push(block.x);
        portalPositions.push(block.y);
        portalPositions.push(block.z);
        portalPositions.push(1.0);
      })
      let portalPositionsF32: Float32Array = new Float32Array(portalPositions);
      this.portalRenderPass.updateAttributeBuffer(
          'aOffset', portalPositionsF32);
      this.portalRenderPass.drawInstanced(this.portals[0].blocks.length);
    }
  }

  public getGUI(): GUI {
    return this.gui;
  }

  public jump() {
    // TODO: If the player is not already in the lair, launch them upwards at 10
    // units/sec.
    if (this.onGround) {
      this.verticalVelocity = new Vec3([0.0, Config.JUMP_VELOCITY, 0.0]);
    }
  }

  public updateSelectedCube(selectedCube: Vec3) {
    this.selectedCubeF32 = new Float32Array(4 * 1);
    this.selectedCubeF32[0] = selectedCube.x;
    this.selectedCubeF32[1] = selectedCube.y;
    this.selectedCubeF32[2] = selectedCube.z;
    this.selectedCubeF32[3] =
        2.0;  // We use 2.0 to indicate that the cube should be highlighted, as
              // seen in the shader

    // We globally determine the block selected and if it should be removed (ie
    // with this.removeCube)
    let isRemovingCube = false;
    let isPortal = this.portals.some(
        (portal: Portal) => {return portal.blockIn(selectedCube)});
    // console.log(isPortal, selectedCube.xyz);
    for (let chunk in this.chunks) {
      isRemovingCube = isRemovingCube ||
          this.chunks[chunk].updateSelected(
              this.highlightOn, selectedCube, this.portals[0]);
    }
    this.removeCube = isRemovingCube;
    this.highlightSelected = true;
  }

  public modifyLandscape(selectedCube: Vec3) {
    const x = selectedCube.x;
    const y = selectedCube.y;
    const z = selectedCube.z;
    // See if the selected cube is already in the modification log
    let newLog: number[][] = [];
    let cubeInLog = false;
    for (let i = 0; i < this.modificationLog.length; ++i) {
      // Checks if the cube is already in the log
      if (this.modificationLog[i][0] == x && this.modificationLog[i][1] == y &&
          this.modificationLog[i][2] == z) {
        cubeInLog = true;
      } else {
        newLog.push(this.modificationLog[i]);
      }
    }
    // Remove the cube if it already exists (reverting to original chunk),
    // otherwise add it
    if (!cubeInLog) {
      newLog.push([x, y, z, this.removeCube ? -1 : 1]);
    }
    this.modificationLog = newLog;
    // Portal
    if (this.gui.currentBlock == 2) {
      // Create a new portal instance
      if (!this.removeCube) {
        if (this.portals.length === 0) {
          let portal = new Portal(selectedCube, new Vec3([1, 1, 1]), 1, 1);
          // Set up new render pass
          this.portals.push(portal);
          // These are arbitrary values but useful for debugging
          let pos: Vec3 = new Vec3([x, y, z]);
          // this means we are looking out on the +z axis
          let look: Vec3 = new Vec3([0.0, 0.0, -1.0]);
          let up: Vec3 = new Vec3([0.0, 1.0, 0.0]);
          this.portalInputCamera = new Camera(
              pos, Vec3.sum(pos, look), up, 45,
              this.ctx.drawingBufferWidth / this.ctx.drawingBufferHeight, 0.1,
              1000.0);

        } else {
          // Loop thorugh all portals and see if the selected cube can be added
          let canAdd = this.portals.filter((portal) => {
            return portal.canAdd(selectedCube);
          });

          // TODO: 2+ Merge portal logic
          if (canAdd.length === 0) {
            let portal = new Portal(selectedCube, new Vec3([1, 1, 1]), 1, 1);
            this.portals.push(portal);
          }
        }
      }
    } else {
      // Update log and all chunks
      for (let chunk in this.chunks) {
        this.chunks[chunk].updateLandscape(this.removeCube, selectedCube);
      }
      this.removeCube = !this.removeCube;
    }
  }
}

export function initializeCanvas(): void {
  const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
  /* Start drawing */
  const canvasAnimation: MinecraftAnimation = new MinecraftAnimation(canvas);
  canvasAnimation.start();
}
