import {Mat4, Vec3, Vec4} from '../lib/TSM.js';
import {Camera} from '../lib/webglutils/Camera.js';
import {CanvasAnimation, WebGLUtilities,} from '../lib/webglutils/CanvasAnimation.js';
import {Debugger} from '../lib/webglutils/Debugging.js';
import {RenderPass} from '../lib/webglutils/RenderPass.js';

import {Chunk} from './Chunk.js';
import {Cube} from './Cube.js';
import {GUI} from './Gui.js';
import {blankCubeFSText, blankCubeVSText} from './Shaders.js';

export class Config {
  public static PLAYER_RADIUS: number = 0.4;
  public static PLAYER_HEIGHT: number = 2.0;
  public static CHUNK_SIZE: number = 64.0;
  public static GRAVITY: number = -9.8;
  public static JUMP_VELOCITY: number = 10.0;
}

export class MinecraftAnimation extends CanvasAnimation {
  private gui: GUI;

  chunks: {};
  chunk: Chunk;

  /*  Cube Rendering */
  private cubeGeometry: Cube;
  private blankCubeRenderPass: RenderPass;

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
    this.chunks = {}

                  this.blankCubeRenderPass =
        new RenderPass(gl, blankCubeVSText, blankCubeFSText);
    this.cubeGeometry = new Cube();
    this.initBlankCube();

    this.lightPosition = new Vec4([-1000, 1000, -1000, 1]);
    this.backgroundColor = new Vec4([0.0, 0.37254903, 0.37254903, 1.0]);
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

    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        xCoords.push(centerX + Config.CHUNK_SIZE * i);
        zCoords.push(centerZ + Config.CHUNK_SIZE * j);
      }
    }

    let newChunks = {};
    for (let i = 0; i < 9; i++) {
      const key = this.chunkKey(xCoords[i], zCoords[i]);
      if (key in this.chunks) {
        newChunks[key] = this.chunks[key];
      } else {
        newChunks[key] = new Chunk(xCoords[i], zCoords[i], Config.CHUNK_SIZE);
      }
      if (i == 4) {
        this.chunk = newChunks[key];
      }
    }
    this.chunks = newChunks;
  }

  private collisionChunks(cameraLocation: Vec3): Chunk[] {
    let candidates: Chunk[] = [];
    candidates.push(this.chunk);
    const center: Vec3 = this.chunk.getChunkCenter();
    const xMod = cameraLocation.x % Config.CHUNK_SIZE - Config.CHUNK_SIZE / 2;
    const zMod = cameraLocation.z % Config.CHUNK_SIZE - Config.CHUNK_SIZE / 2;
    if (zMod <= 0.0 && zMod >= -1.0) {
      candidates.push(
          this.chunks[this.chunkKey(center.x, center.z + Config.CHUNK_SIZE)]);
    }
    if (zMod >= 0.0 && zMod <= 1.0) {
      candidates.push(
          this.chunks[this.chunkKey(center.x, center.z - Config.CHUNK_SIZE)]);
    }
    if (xMod <= 0.0 && xMod >= -1.0) {
      candidates.push(
          this.chunks[this.chunkKey(center.x + Config.CHUNK_SIZE, center.z)]);
    }
    if (xMod >= 0.0 && xMod <= 1.0) {
      candidates.push(
          this.chunks[this.chunkKey(center.x - Config.CHUNK_SIZE, center.z)]);
    }
    if (zMod <= 0.0 && zMod >= -1.0 && xMod <= 0.0 && xMod >= -1.0) {
      candidates.push(this.chunks[this.chunkKey(
          center.x + Config.CHUNK_SIZE, center.z + Config.CHUNK_SIZE)]);
    }
    if (zMod <= 0.0 && zMod >= -1.0 && xMod >= 0.0 && xMod <= 1.0) {
      candidates.push(this.chunks[this.chunkKey(
          center.x - Config.CHUNK_SIZE, center.z + Config.CHUNK_SIZE)]);
    }
    if (zMod >= 0.0 && zMod <= 1.0 && xMod <= 0.0 && xMod >= -1.0) {
      candidates.push(this.chunks[this.chunkKey(
          center.x + Config.CHUNK_SIZE, center.z - Config.CHUNK_SIZE)]);
    }
    if (zMod >= 0.0 && zMod <= 1.0 && xMod >= 0.0 && xMod <= 1.0) {
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
   * Sets up the blank cube drawing
   */
  private initBlankCube(): void {
    this.blankCubeRenderPass.setIndexBufferData(
        this.cubeGeometry.indicesFlat());
    this.blankCubeRenderPass.addAttribute(
        'aVertPos', 4, this.ctx.FLOAT, false,
        4 * Float32Array.BYTES_PER_ELEMENT, 0, undefined,
        this.cubeGeometry.positionsFlat());

    this.blankCubeRenderPass.addAttribute(
        'aNorm', 4, this.ctx.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT,
        0, undefined, this.cubeGeometry.normalsFlat());

    this.blankCubeRenderPass.addAttribute(
        'aUV', 2, this.ctx.FLOAT, false, 2 * Float32Array.BYTES_PER_ELEMENT, 0,
        undefined, this.cubeGeometry.uvFlat());

    this.blankCubeRenderPass.addInstancedAttribute(
        'aOffset', 4, this.ctx.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT,
        0, undefined, new Float32Array(0));

    this.blankCubeRenderPass.addUniform(
        'uLightPos', (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
          gl.uniform4fv(loc, this.lightPosition.xyzw);
        });
    this.blankCubeRenderPass.addUniform(
        'uProj', (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
          gl.uniformMatrix4fv(
              loc, false, new Float32Array(this.gui.projMatrix().all()));
        });
    this.blankCubeRenderPass.addUniform(
        'uView', (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
          gl.uniformMatrix4fv(
              loc, false, new Float32Array(this.gui.viewMatrix().all()));
        });

    this.blankCubeRenderPass.setDrawData(
        this.ctx.TRIANGLES, this.cubeGeometry.indicesFlat().length,
        this.ctx.UNSIGNED_INT, 0);
    this.blankCubeRenderPass.setup();
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
    let position: Vec3 = new Vec3(this.playerPosition.xyz);
    position.add(this.gui.walkDir());
    if (!position.equals(this.playerPosition)) {
      let chunks: Chunk[] = this.collisionChunks(this.playerPosition);
      let safe: boolean = true;
      for (let i = 0; i < chunks.length; i++) {
        if (chunks[i].sideCollision(position)) {
          // console.log("SIDE COLLISION");
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
    let velocity: Vec3 = new Vec3(
        [0.0, Config.GRAVITY * (Date.now() - this.gravityTime) / 1000.0, 0.0]);
    velocity.add(this.verticalVelocity);
    velocity.scale((Date.now() - this.frameTime) / 1000.0)
    position.add(velocity);
    this.frameTime = Date.now();
    // console.log(velocity, this.frameTime);
    let height = this.chunk.verticalCollision(position);
    if (height != Number.MIN_SAFE_INTEGER) {
      this.playerPosition.y = height + Config.PLAYER_HEIGHT;
      this.onGround = true;
      this.verticalVelocity = new Vec3();
      this.gravityTime = Date.now();
    } else {
      this.onGround = false;
      this.playerPosition = position;
    }
    this.gui.getCamera().setPos(this.playerPosition);

    // Drawing
    const gl: WebGLRenderingContext = this.ctx;
    const bg: Vec4 = this.backgroundColor;
    gl.clearColor(bg.r, bg.g, bg.b, bg.a);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.frontFace(gl.CCW);
    gl.cullFace(gl.BACK);

    gl.bindFramebuffer(
        gl.FRAMEBUFFER, null);  // null is the default frame buffer
    this.drawScene(0, 0, 1280, 960);
  }

  private drawScene(x: number, y: number, width: number, height: number): void {
    const gl: WebGLRenderingContext = this.ctx;
    gl.viewport(x, y, width, height);

    // TODO: Render multiple chunks around the player, using Perlin noise
    // shaders
    // let chunk_coord: Vec3 = this.chunk.getChunkCenter();
    // let player_cord: Vec3 = this.playerPosition;

    // TODO: Render instances of cubes that are seen by the player
    for (let chunk in this.chunks) {
      this.blankCubeRenderPass.updateAttributeBuffer(
          'aOffset', this.chunks[chunk].cubePositions());
      this.blankCubeRenderPass.drawInstanced(this.chunks[chunk].numCubes());
    }
    // this.blankCubeRenderPass.updateAttributeBuffer(
    //     'aOffset', this.chunk.cubePositions());
    // this.blankCubeRenderPass.drawInstanced(this.chunk.numCubes());
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
}

export function initializeCanvas(): void {
  const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
  /* Start drawing */
  const canvasAnimation: MinecraftAnimation = new MinecraftAnimation(canvas);
  canvasAnimation.start();
}
