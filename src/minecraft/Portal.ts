import {Vec3, Vec4} from '../lib/TSM.js';
import {Camera} from '../lib/webglutils/Camera.js';
import { RenderPass } from '../lib/webglutils/RenderPass.js';
import { Config } from './App.js';
import {blankCubeFSText, blankCubeVSText} from './Shaders.js';


// Creates a two dimensional rectangular portal
export class Portal {
  private position: Vec3;  // center of the portal in world space
  private normal: Vec3;    // normal of face of portal, determines orientation
  private width: number;   // width of portal
  private height: number;  // height of portal
  public outlet: Portal|null;  // the portal that this portal leads to
  public blocks: Vec3[];  // Coordinates of blocks that are part of the portal
  private blocksF32: Float32Array;
  private highlightedCubePos: number;

  private generatePortal: boolean;  // Determines whether portal can be activated
  public portalMesh: PortalMesh;    // Portal mesh
  private portalCubeLoc: Vec3;
  private differential: Vec3;
  public portalCamera: Camera;
  public portalRenderPass: RenderPass;


  constructor(position: Vec3, normal: Vec3, width: number, height: number) {
    this.position = position;  // First block is the center of the portal
    this.normal = normal;
    this.width = width;
    this.height = height;
    this.outlet = null;
    this.blocks = [position];
    this.blocksF32 = new Float32Array([...position.xyz, 5]);
    this.highlightedCubePos = 0;
    this.generatePortal = false;
  }

  public getPortalTeleportPosition(dir: Vec3): any[] {
    if (this.outlet === null) {
      return [false];
    }
    const normal = new Vec3(this.outlet.normal.xyz);
    const teleported = new Vec3([this.outlet.position.x, this.outlet.position.y + 0.5, this.outlet.position.z]);
    let scale = 5;
    if (Vec3.dot(this.outlet.normal, dir) < 0) {
      scale = -5;
    }
    normal.scale(scale);
    const newPos = Vec3.sum(teleported, normal);
    return [true, newPos];
  }

  // Given position of player, find distance to portal
  public distanceTo(position: Vec3): number {
    return 0;
  }
  // Given position of player, is player inside portal?
  public intersects(position: Vec3): boolean {
    // Portal not activated
    if (!this.generatePortal || this.outlet === null || this.portalMesh == null) {
      return false;
    }
    const topLeft = new Vec3([Math.min(this.portalCubeLoc.x, this.portalCubeLoc.x + this.differential.x),
                              Math.min(this.portalCubeLoc.y, this.portalCubeLoc.y + this.differential.y),
                              Math.min(this.portalCubeLoc.z, this.portalCubeLoc.z + this.differential.z)])
    const bottomRight = new Vec3([Math.max(this.portalCubeLoc.x, this.portalCubeLoc.x + this.differential.x),
                                  Math.max(this.portalCubeLoc.y, this.portalCubeLoc.y + this.differential.y),
                                  Math.max(this.portalCubeLoc.z, this.portalCubeLoc.z + this.differential.z)])
    // Below or above portal
    if (position.y < topLeft.y ||
        position.y - Config.PLAYER_HEIGHT > bottomRight.y) {
      return false;
    }
    // Out of bounds of portal
    if (position.x + Config.PLAYER_RADIUS < topLeft.x ||
        position.x - Config.PLAYER_RADIUS > bottomRight.x ||
        position.z + Config.PLAYER_RADIUS < topLeft.z ||
        position.z - Config.PLAYER_RADIUS > bottomRight.z) {
      return false;
    }
    return true;
  }

  // Uses floodfill to determine if a block is part of the portal
  public addBlockIfPartOfPortal(position: Vec3): boolean {
    // Top
    // Bottom
    // Left
    // Right
    return true;
  }

  private updateBlockF32() {
    this.blocksF32 = new Float32Array(4 *this.blocks.length);
    for (let i = 0; i < this.blocks.length; ++i) {
      this.blocksF32[4 * i] = this.blocks[i].x;
      this.blocksF32[4 * i + 1] = this.blocks[i].y; 
      this.blocksF32[4 * i + 2] = this.blocks[i].z; 
      this.blocksF32[4 * i + 3] = 5.0;
    }
  }

  public addBlock(pos: Vec3) {
    this.blocks.push(pos);
    this.updateBlockF32();
      // Determine if portal should be added or removed based on block change
    this.generatePortal = this.createPortal();
  }

  public merge(blocks: Vec3[]) {
    for (let i = 0; i < blocks.length; ++i) {
      if (!this.blockIn(blocks[i])) {
        this.blocks.push(blocks[i]);
      }
    }
    this.updateBlockF32();
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
      // this.blocks.push(pos);
      // // Determine if portal should be added or removed based on block change
      // this.generatePortal = this.createPortal();
      return true;
    }
    return false;
  }
  public blockIn(pos: Vec3): boolean {
    return this.blocks.some(block => {
      return block.x === pos.x && block.y === pos.y && block.z === pos.z;
    });
  }

  private createPortal() {
    // Min number of blocks required to make a portal
    if (this.blocks.length < 8) {
      
      return false;
    }
    let topLeft = new Vec3(this.blocks[0].xyz);
    let bottomRight = new Vec3(this.blocks[0].xyz);
    for (let i = 0; i < this.blocks.length; ++i) {
      topLeft.x = Math.floor(Math.min(topLeft.x, this.blocks[i].x));
      topLeft.y = Math.floor(Math.min(topLeft.y, this.blocks[i].y));
      topLeft.z = Math.floor(Math.min(topLeft.z, this.blocks[i].z));

      bottomRight.x = Math.floor(Math.max(bottomRight.x, this.blocks[i].x));
      bottomRight.y = Math.floor(Math.max(bottomRight.y, this.blocks[i].y));
      bottomRight.z = Math.floor(Math.max(bottomRight.z, this.blocks[i].z));
    }
    // Portal must be two dimensional grid
    if (bottomRight.x - topLeft.x !== 0 &&
        bottomRight.y - topLeft.y !== 0 &&
        bottomRight.z - topLeft.z !== 0) {
        
        return false;
    }

    // Get non-zero dimensions
    let dim1 = 0;
    let dim2 = 1;
    if (bottomRight.x - topLeft.x === 0) {
      dim1 = 1;
      dim2 = 2;
    } else if (bottomRight.y - topLeft.y === 0) {
      dim1 = 0;
      dim2 = 2;
    }
    let sizes = [bottomRight.x - topLeft.x + 1, bottomRight.y - topLeft.y + 1, bottomRight.z - topLeft.z + 1];

    // Must be hole in portal block grid
    if (sizes[dim1] <= 2 || sizes[dim2] <= 2) {
      
      return false;
    }

    // Make sure all blocks are edge blocks
    const numEdgeBlocks = sizes[dim1] * 2 + (sizes[dim2] - 2) * 2;
    if (this.blocks.length !== numEdgeBlocks) {
      
      return false;
    }
    const edgeDims = [[topLeft.x, bottomRight.x], [topLeft.y, bottomRight.y], [topLeft.z, bottomRight.z]]
    for (let i = 0; i < this.blocks.length; ++i) {
      const blockPos = this.blocks[i].xyz;
      if (blockPos[dim1] !== edgeDims[dim1][0] && 
          blockPos[dim1] !== edgeDims[dim1][1] &&
          blockPos[dim2] !== edgeDims[dim2][0] && 
          blockPos[dim2] !== edgeDims[dim2][1]) {
        
        return false;
      }
    }
    this.position = new Vec3([(topLeft.x + bottomRight.x)/2, (topLeft.y + bottomRight.y)/2, (topLeft.z + bottomRight.z)/2])
    
    return true;
  }

  public removeCube(pos: Vec3) {
    // Remove chosen block
    
    this.blocks = this.blocks.filter(block => {
      return block.x !== pos.x || block.y !== pos.y || block.z !== pos.z;
    });
    
    // Partition block list if necessary
    const partitions: Vec3[][] = [];
    const visited = new Set<number>();
    for (let i = 0; i < this.blocks.length; ++i) {
      if (!visited.has(i)) {
        partitions.push(this.floodFill(i, visited));
      }
    }
    
    // Update current block list to the first partition
    if (partitions.length > 0) {
      this.blocks = partitions[0];
    }
    
    // Determine if portal should be added or removed based on block change
    this.updateBlockF32();
    this.generatePortal = this.createPortal();
    return partitions;
  }

  private floodFill(start: number, visited: Set<number>): Vec3[] {
    const blocks: Vec3[] = [];
    const queue: number[] = [start];
    while (queue.length > 0) {
      const idx: number = queue[0];
      queue.shift();
      if (visited.has(idx)) {
        continue;
      }
      const currBlock = this.blocks[idx];
      visited.add(idx);
      blocks.push(this.blocks[idx]);
      for (let i = 0; i < this.blocks.length; ++i) {
        if (Math.abs(currBlock.x - this.blocks[i].x) +
            Math.abs(currBlock.y - this.blocks[i].y) +
            Math.abs(currBlock.z - this.blocks[i].z) < 1.1) {
            if (!visited.has(i)) {
              queue.push(i);
            }
        }
      }
    }
    return blocks;
  }

  public setOutlet(portal2: null|Portal, gl) {
    this.outlet = portal2;
    if (portal2 == null || this.outlet === null) {
      return;
    }
    // Get mesh corner and axis
    let topLeft = new Vec3(this.blocks[0].xyz);
    let bottomRight = new Vec3(this.blocks[0].xyz);
    for (let i = 0; i < this.blocks.length; ++i) {
      topLeft.x = Math.floor(Math.min(topLeft.x, this.blocks[i].x));
      topLeft.y = Math.floor(Math.min(topLeft.y, this.blocks[i].y));
      topLeft.z = Math.floor(Math.min(topLeft.z, this.blocks[i].z));

      bottomRight.x = Math.floor(Math.max(bottomRight.x, this.blocks[i].x));
      bottomRight.y = Math.floor(Math.max(bottomRight.y, this.blocks[i].y));
      bottomRight.z = Math.floor(Math.max(bottomRight.z, this.blocks[i].z));
    }
    let corner = new Vec3(topLeft.xyz);
    corner.x += 0.5;
    corner.y += 0.5;
    corner.z += 0.5;
    let axis2 = new Vec3([bottomRight.x - topLeft.x - 1, 0, 0]);
    let axis1 = new Vec3([0, bottomRight.y - topLeft.y - 1, 0]);
    let axis3 = new Vec3([0, 0, -1]);
    if (bottomRight.x - topLeft.x == 0) {
      axis2 = new Vec3([0, 0, bottomRight.z - topLeft.z - 1]);
      axis3 = new Vec3([-1, 0, 0]);

    } else if (bottomRight.y - topLeft.y == 0) {
      axis1 = new Vec3([0, 0, bottomRight.z - topLeft.z - 1]);
      axis3 = new Vec3([0, -1, 0]);
    }
    this.portalCubeLoc = new Vec3(topLeft.xyz);
    this.differential = Vec3.sum(Vec3.sum(axis1, axis2), axis3);
    this.normal = Vec3.cross(axis1, axis2);
    this.normal.normalize();
    this.normal.scale(Config.PLAYER_RADIUS);
    // Create mesh
    this.portalMesh = new PortalMesh(corner, axis1, axis2, axis3);
    // Set camera portal
    const pos = portal2.position;
    const up = axis1;
    const look = Vec3.cross(axis1, axis2);
    up.normalize();
    look.normalize();
    console.log(up.xyz, Vec3.sum(pos, look).xyz)
    this.portalCamera = new Camera(
      pos, Vec3.sum(pos, look), up, 45,
      gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 1000.0);
    // Set up render pass
    this.portalRenderPass = new RenderPass(gl, blankCubeVSText, blankCubeFSText);
  }

  public activePortal() {
    return this.generatePortal;
  }

   // Returns if a cube is in the chunk and highlights it if it is
   public updateSelected(highlightOn: boolean, selectedCube: Vec3, isPortal: boolean, portals: Portal[]): boolean {
    // Is this a portal block?

    // Reset the previously highlighted box
    if (this.highlightedCubePos < this.blocks.length) {
      this.blocksF32[4 * this.highlightedCubePos + 3] = 5.0;
    }
    // Do not highlight if highlighting is turned off
    if (!highlightOn) {
      return false;
    }

    // Find if the cube is rendered in the current chunk and highlight if so
    for (let i = 0; i < this.blocks.length; ++i) {
      if (this.blocksF32[4 * i] == selectedCube.x &&
          this.blocksF32[4 * i + 1] == selectedCube.y &&
          this.blocksF32[4 * i + 2] == selectedCube.z) {
        this.blocksF32[4 * i + 3] = 3;  // Highlight
        this.highlightedCubePos = i;
        return true;
      } else {
        this.blocksF32[4 * i + 3] = 5.0;
      }
    }
    return false;
  }

  public cubePositions() {
    return this.blocksF32;
  }

  public numCubes() {
    return this.blocks.length;
  }
}

// 2D mesh for portal
export class PortalMesh {
  public center: Vec3;
  private positionsF32: Float32Array;
  private indicesU32: Uint32Array;
  private normalsF32: Float32Array;
  private uvF32: Float32Array;

  private positionsRay: Vec4[];
  private indicesRay: Vec3[];
  private normalsRay: Vec4[];
  private uvRay: Vec3[];

  // We assume a 1x1 square centered at the origin
  constructor(corner: Vec3, axis1: Vec3, axis2: Vec3, axis3: Vec3) {
    this.positionsRay = [
      /* Front */
      new Vec4([corner.x, corner.y, corner.z, 1.0]),
      new Vec4([corner.x + axis1.x, corner.y + axis1.y, corner.z + axis1.z, 1.0]),
      new Vec4([corner.x + axis2.x, corner.y + axis2.y, corner.z + axis2.z, 1.0]),
      new Vec4([corner.x + axis2.x + axis1.x, corner.y + axis2.y + axis1.y, corner.z + axis2.z + axis1.z, 1.0]),

      /* Back */
      new Vec4([corner.x + axis3.x, corner.y + axis3.y, corner.z + axis3.z, 1.0]),
      new Vec4([corner.x + axis3.x + axis1.x, corner.y + axis3.y + axis1.y, corner.z + axis3.z + axis1.z, 1.0]),
      new Vec4([corner.x + axis3.x + axis2.x, corner.y + axis3.y + axis2.y, corner.z + axis3.z + axis2.z, 1.0]),
      new Vec4([corner.x + axis3.x + axis2.x + axis1.x, corner.y + axis3.y + axis2.y + axis1.y, corner.z + axis3.z + axis2.z + axis1.z, 1.0])
    ]
    
    
    this.positionsF32 = new Float32Array(this.positionsRay.length * 4);
    this.positionsRay.forEach((v: Vec4, i: number) => {
      this.positionsF32.set(v.xyzw, i * 4);
    });
    
    this.indicesRay = [
      /* Top */
      new Vec3([0, 1, 2]),
      new Vec3([1, 3, 2]),
      /* Back */
      new Vec3([5, 4, 6]),
      new Vec3([6, 7, 5]),
    ]
    
    this.indicesU32 = new Uint32Array(this.indicesRay.length * 3);
    this.indicesRay.forEach((v: Vec3, i: number) => {
      this.indicesU32.set(v.xyz, i * 3);
    });
    
    

    const normal = Vec3.cross(axis1, axis2);
    this.normalsRay = [
      /* Front */
      new Vec4([normal.x, normal.y, normal.z, 0.0]),
      new Vec4([normal.x, normal.y, normal.z, 0.0]),
      new Vec4([normal.x, normal.y, normal.z, 0.0]),
      new Vec4([normal.x, normal.y, normal.z, 0.0]),

      /* Back */
      new Vec4([-normal.x, -normal.y, -normal.z, 0.0]),
      new Vec4([-normal.x, -normal.y, -normal.z, 0.0]),
      new Vec4([-normal.x, -normal.y, -normal.z, 0.0]),
      new Vec4([-normal.x, -normal.y, -normal.z, 0.0]),
    ];
    
    
    this.normalsF32 = new Float32Array(this.normalsRay.length * 4);
    this.normalsRay.forEach((v: Vec4, i: number) => {
      this.normalsF32.set(v.xyzw, i * 4);
    });
    
  
    this.uvRay = [
      /* Top */
      new Vec3([0.0, 0.0, 0.0]),
      new Vec3([0.0, 1.0, 0.0]),
      new Vec3([1.0, 0.0, 0.0]),
      new Vec3([1.0, 1.0, 0.0]),
      /* Back */
      new Vec3([0.0, 0.0, 0.0]),
      new Vec3([0.0, 1.0, 0.0]),
      new Vec3([1.0, 0.0, 0.0]),
      new Vec3([1.0, 1.0, 0.0]),
    ]
    
    
    this.uvF32 = new Float32Array(this.uvRay.length * 2);
    this.uvRay.forEach((v: Vec3, i: number) => {
      this.uvF32.set(v.xy, i * 2);
    });
    
  }

  public positionsFlat(): Float32Array {
    return this.positionsF32;
  }

  public indices(): Vec3[] {
    return this.indicesRay;
  }

  public indicesFlat(): Uint32Array {
    return this.indicesU32;
  }

  public normals(): Vec4[] {
    return this.normalsRay;
  }

  public normalsFlat(): Float32Array {
    return this.normalsF32;
  }

  public uvFlat(): Float32Array {
    return this.uvF32;
  }
}