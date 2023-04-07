import {Mat4, Vec3, Vec4} from '../lib/TSM.js';
import {Camera} from '../lib/webglutils/Camera.js';
import {CanvasAnimation, WebGLUtilities,} from '../lib/webglutils/CanvasAnimation.js';
import {Debugger} from '../lib/webglutils/Debugging.js';
import {RenderPass} from '../lib/webglutils/RenderPass.js';

import {Chunk} from './Chunk.js';
import {Cube} from './Cube.js';
import {GUI} from './Gui.js';
import {blankCubeFSText, blankCubeVSText} from './Shaders.js';

export class MinecraftAnimation extends CanvasAnimation {
  private gui: GUI;

  chunks: {}

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

  private chunkSize = 64.0;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);

    this.canvas2d = document.getElementById('textCanvas') as HTMLCanvasElement;

    this.ctx = Debugger.makeDebugContext(this.ctx);
    let gl = this.ctx;

    this.gui = new GUI(this.canvas2d, this);
    this.playerPosition = this.gui.getCamera().pos();

    // Generate initial landscape
    this.chunks = {}

                  this.blankCubeRenderPass =
        new RenderPass(gl, blankCubeVSText, blankCubeFSText);
    this.cubeGeometry = new Cube();
    this.initBlankCube();

    this.lightPosition = new Vec4([-1000, 1000, -1000, 1]);
    this.backgroundColor = new Vec4([0.0, 0.37254903, 0.37254903, 1.0]);
  }

  private generateChunks() {
    let centerX =
        Math.floor(
            (this.playerPosition.x + this.chunkSize / 2) / this.chunkSize) *
        this.chunkSize;
    let centerZ =
        Math.floor(
            (this.playerPosition.z + this.chunkSize / 2) / this.chunkSize) *
        this.chunkSize;
    console.log(centerX, centerZ);

    let xCoords: number[] = [];
    let zCoords: number[] = [];

    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        xCoords.push(centerX + this.chunkSize * i);
        zCoords.push(centerZ + this.chunkSize * j);
      }
    }

    let newChunks = {};
    for (let i = 0; i < 9; i++) {
      const key = `${xCoords[i]}_${zCoords[i]}`;
      if (key in this.chunks) {
        newChunks[key] = this.chunks[key];
      } else {
        newChunks[key] = new Chunk(xCoords[i], zCoords[i], 64);
        // newChunks[key] = new Chunk(xCoords[i], zCoords[i], 8);
      }
    }
    this.chunks = newChunks;
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
    this.playerPosition.add(this.gui.walkDir());

    this.gui.getCamera().setPos(this.playerPosition);

    this.generateChunks();

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
  }
}

export function initializeCanvas(): void {
  const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
  /* Start drawing */
  const canvasAnimation: MinecraftAnimation = new MinecraftAnimation(canvas);
  canvasAnimation.start();
}
