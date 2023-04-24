import {Mat2, Mat4, Quat, Vec2, Vec3, Vec4} from '../lib/TSM.js';
import {Camera} from '../lib/webglutils/Camera.js';
import {CanvasAnimation} from '../lib/webglutils/CanvasAnimation.js';
import {RenderPass} from '../lib/webglutils/RenderPass.js';

import {Config, MinecraftAnimation} from './App.js';

/**
 * Might be useful for designing any animation GUI
 */
interface IGUI {
  viewMatrix(): Mat4;
  projMatrix(): Mat4;
  dragStart(me: MouseEvent): void;
  drag(me: MouseEvent): void;
  dragEnd(me: MouseEvent): void;
  onKeydown(ke: KeyboardEvent): void;
}

/**
 * Handles Mouse and Button events along with
 * the the camera.
 */

export class GUI implements IGUI {
  private static readonly rotationSpeed: number = 0.01;
  public static readonly walkSpeed: number = 0.5;
  private static readonly rollSpeed: number = 0.1;
  private static readonly panSpeed: number = 0.1;

  private camera: Camera;
  private prevX: number;
  private prevY: number;
  private dragging: boolean;

  private height: number;
  private width: number;

  private animation: MinecraftAnimation;

  private Adown: boolean;
  private Wdown: boolean;
  private Sdown: boolean;
  private Ddown: boolean;
  private SpaceDown: boolean;
  private ShiftLeftDown: boolean;

  private selectedCube: Vec3;

  // We will use this to render different types of blocks
  public currentBlock: number;

  /**
   *
   * @param canvas required to get the width and height of the canvas
   * @param animation required as a back pointer for some of the controls
   */
  constructor(canvas: HTMLCanvasElement, animation: MinecraftAnimation) {
    this.height = canvas.height;
    this.width = canvas.width;
    this.prevX = 0;
    this.prevY = 0;
    this.dragging = false;

    this.animation = animation;
    // Default type of block, the one that is normally rendered at a height
    this.currentBlock = 1;

    this.reset();

    this.registerEventListeners(canvas);
  }

  /**
   * Resets the state of the GUI
   */
  public reset(): void {
    this.camera = new Camera(
        new Vec3([0, 100, 0]), new Vec3([0, 100, -1]), new Vec3([0, 1, 0]), 45,
        this.width / this.height, 0.1, 1000.0);
  }

  /**
   * Sets the GUI's camera to the given camera
   * @param cam a new camera
   */
  public setCamera(
      pos: Vec3, target: Vec3, upDir: Vec3, fov: number, aspect: number,
      zNear: number, zFar: number) {
    this.camera = new Camera(pos, target, upDir, fov, aspect, zNear, zFar);
  }

  /**
   * Returns the view matrix of the camera
   */
  public viewMatrix(): Mat4 {
    return this.camera.viewMatrix();
  }

  /**
   * Returns the projection matrix of the camera
   */
  public projMatrix(): Mat4 {
    return this.camera.projMatrix();
  }

  public getCamera(): Camera {
    return this.camera;
  }

  public dragStart(mouse: MouseEvent): void {
    if (mouse.buttons == 1) {
      this.prevX = mouse.screenX;
      this.prevY = mouse.screenY;
      this.dragging = true;
    } else {
      // Called whenever mouse 2 is clicked
      this.animation.modifyLandscape(this.selectedCube);
    }
  }
  public dragEnd(mouse: MouseEvent): void {
    this.dragging = false;
  }

  /**
   * The callback function for a drag event.
   * This event happens after dragStart and
   * before dragEnd.
   * @param mouse
   */
  public drag(mouse: MouseEvent): void {
    let x = mouse.offsetX;
    let y = mouse.offsetY;
    const dx = mouse.screenX - this.prevX;
    const dy = mouse.screenY - this.prevY;
    this.prevX = mouse.screenX;
    this.prevY = mouse.screenY;
    if (this.dragging) {
      this.camera.rotate(new Vec3([0, 1, 0]), -GUI.rotationSpeed * dx);
      this.camera.rotate(this.camera.right(), -GUI.rotationSpeed * dy);
    }

    const mouseNDC =
        new Vec4([(x / this.width) * 2 - 1, 1 - (y / this.height) * 2, -1, 1]);
    const mouseProjection = this.projMatrix().inverse().multiplyVec4(mouseNDC);
    let mouseWorld = this.viewMatrix().inverse().multiplyVec4(mouseProjection);
    mouseWorld.scale(1 / mouseWorld.w);

    const ray = Vec3.difference(new Vec3(mouseWorld.xyz), this.camera.pos())
                    .normalize();
    const origin = this.camera.pos();

    // Get the next block from the players current position.
    let t = Config.SELECT_RADIUS;
    ray.scale(t);
    const selectedCube = Vec3.sum(origin, ray);
    this.selectedCube = new Vec3([
      Math.round(selectedCube.x), Math.round(selectedCube.y),
      Math.round(selectedCube.z)
    ]);
    this.animation.updateSelectedCube(this.selectedCube);
  }

  public walkDir(): Vec3 {
    let answer = new Vec3();
    if (this.Wdown) answer.add(this.camera.forward().negate());
    if (this.Adown) answer.add(this.camera.right().negate());
    if (this.Sdown) answer.add(this.camera.forward());
    if (this.Ddown) answer.add(this.camera.right());
    answer.y = 0;
    answer.normalize();
    if (Config.CREATIVE_MODE && this.SpaceDown)
      answer.add(new Vec3([0.0, 1.0, 0.0]));
    if (Config.CREATIVE_MODE && this.ShiftLeftDown)
      answer.add(new Vec3([0.0, -1.0, 0.0]));
    return answer;
  }

  /**
   * Callback function for a key press event
   * @param key
   */
  public onKeydown(key: KeyboardEvent): void {
    switch (key.code) {
      case 'Digit1': {
        // Default Block
        this.currentBlock = 1;
        break;
      }
      case 'Digit2': {
        // Portal Block
        this.currentBlock = 2;
        break;
      }
      case 'KeyW': {
        this.Wdown = true;
        break;
      }
      case 'KeyA': {
        this.Adown = true;
        break;
      }
      case 'KeyS': {
        this.Sdown = true;
        break;
      }
      case 'KeyD': {
        this.Ddown = true;
        break;
      }
      case 'KeyH': {
        this.animation.highlightOn = !this.animation.highlightOn;
        break;
      }
      case 'KeyR': {
        this.animation.reset();
        break;
      }
      case 'KeyP': {
        Config.PERLIN_3D = !Config.PERLIN_3D;
        break;
      }
      case 'Space': {
        this.SpaceDown = true;
        if (!Config.CREATIVE_MODE) {
          this.animation.jump();
        }
        break;
      }
      case 'ShiftLeft': {
        this.ShiftLeftDown = true;
        break;
      }
      case 'ArrowLeft': {
        Config.DAY_TIME_SECONDS =
            Math.max(10.0, Config.DAY_TIME_SECONDS - 10.0);
        console.log(
            `Current Day/Night Cycle Time (s): ${Config.DAY_TIME_SECONDS}`);
        break;
      }
      case 'ArrowRight': {
        Config.DAY_TIME_SECONDS += 10.0;
        console.log(
            `Current Day/Night Cycle Time (s): ${Config.DAY_TIME_SECONDS}`);
        break;
      }
      case 'KeyC': {
        Config.CREATIVE_MODE = Config.CREATIVE_MODE ? false : true;
        console.log(`Creative Mode Enabled: ${Config.CREATIVE_MODE}`);
        break;
      }
      default: {
        console.log('Key : \'', key.code, '\' was pressed.');
        break;
      }
    }
  }

  public onKeyup(key: KeyboardEvent): void {
    switch (key.code) {
      case 'KeyW': {
        this.Wdown = false;
        break;
      }
      case 'KeyA': {
        this.Adown = false;
        break;
      }
      case 'KeyS': {
        this.Sdown = false;
        break;
      }
      case 'KeyD': {
        this.Ddown = false;
        break;
      }
      case 'Space': {
        this.SpaceDown = false;
        break;
      }
      case 'ShiftLeft': {
        this.ShiftLeftDown = false;
        break;
      }
    }
  }

  /**
   * Registers all event listeners for the GUI
   * @param canvas The canvas being used
   */
  private registerEventListeners(canvas: HTMLCanvasElement): void {
    /* Event listener for key controls */
    window.addEventListener(
        'keydown', (key: KeyboardEvent) => this.onKeydown(key));

    window.addEventListener('keyup', (key: KeyboardEvent) => this.onKeyup(key));

    /* Event listener for mouse controls */
    canvas.addEventListener(
        'mousedown', (mouse: MouseEvent) => this.dragStart(mouse));

    canvas.addEventListener(
        'mousemove', (mouse: MouseEvent) => this.drag(mouse));

    canvas.addEventListener(
        'mouseup', (mouse: MouseEvent) => this.dragEnd(mouse));

    /* Event listener to stop the right click menu */
    canvas.addEventListener(
        'contextmenu', (event: any) => event.preventDefault());
  }
}


// Portal should be in its own file, but imports bugs are a pain.
export class Portal {
  private position: Vec3;  // center of the portal in world space
  private normal: Vec3;    // normal of face of portal, determines orientation
  private width: number;   // width of portal
  private height: number;  // height of portal
  private outlet: Portal|null;  // the portal that this portal leads to
  private camera: Camera;
  public blocks: Vec3[];  // Coordinates of blocks that are part of the portal


  constructor(position: Vec3, normal: Vec3, width: number, height: number) {
    this.position = position;  // First block is the center of the portal
    this.normal = normal;
    this.width = width;
    this.height = height;
    this.outlet = null;
    this.blocks = [position];

    // Default to test the camera perspective on portal.
    this.camera = new Camera(
        new Vec3([0, 100, 0]), new Vec3([0, 100, -1]), new Vec3([0, 1, 0]), 45,
        this.width / this.height, 0.1, 1000.0);
  }

  public getPortalTeleportPosition(): Vec3 {
    return this.outlet ? this.outlet.position : this.position;
  }

  // Given position of player, find distance to portal
  public distanceTo(position: Vec3): number {
    return 0;
  }
  // Given position of player, is player inside portal?
  public intersects(position: Vec3): boolean {
    return true;
  }

  public getCamera(): Camera {
    return this.camera;
  }

  // Uses floodfill to determine if a block is part of the portal
  public addBlockIfPartOfPortal(position: Vec3): boolean {
    // Top
    // Bottom
    // Left
    // Right
    return true;
  }


  // Given camera of player, calculate what the camera should be on the other
  // side of the portal
  public getCameraInfo(camera: Camera): Camera {
    return camera;
  }
  public canAdd(pos: Vec3): boolean {
    // TODO: Put orientation logic
    let adj = this.blocks
                  .filter(block => {
                    let dist = (block.x - pos.x) ** 2 + (block.y - pos.y) ** 2 +
                        (block.z - pos.z) ** 2;
                    return dist <= 1;
                  })
                  .length;
    if (adj >= 1) {
      this.blocks.push(pos);
      return true;
    }
    return false;
  }
  public blockIn(pos: Vec3): boolean {
    return this.blocks.some(block => {
      return block.x === pos.x && block.y === pos.y && block.z === pos.z;
    });
  }
}

// 2D mesh for portal
export class PortalMesh {
  public center: Vec3;
  private positionsF32: Float32Array;
  private indicesU32: Uint32Array;
  private normalF32: Float32Array;
  private uvF32: Float32Array;

  // We assume a 1x1 square centered at the origin
  constructor(center: Vec3) {}
}