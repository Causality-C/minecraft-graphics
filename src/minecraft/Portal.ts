import {Vec3, Vec4} from '../lib/TSM.js';
import {Camera} from '../lib/webglutils/Camera';


// Creates a two dimensional rectangular portal
export class Portal {
  private position: Vec3;  // center of the portal in world space
  private normal: Vec3;    // normal of face of portal, determines orientation
  private width: number;   // width of portal
  private height: number;  // height of portal
  public outlet: Portal|null;  // the portal that this portal leads to
  public blocks: Vec3[];  // Coordinates of blocks that are part of the portal

  private generatePortal: boolean;  // Determines whether portal can be activated
  public portalMesh: PortalMesh;


  constructor(position: Vec3, normal: Vec3, width: number, height: number) {
    this.position = position;  // First block is the center of the portal
    this.normal = normal;
    this.width = width;
    this.height = height;
    this.outlet = null;
    this.blocks = [position];
    this.generatePortal = false;
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

  // Uses floodfill to determine if a block is part of the portal
  public addBlockIfPartOfPortal(position: Vec3): boolean {
    // Top
    // Bottom
    // Left
    // Right
    return true;
  }

  public addBlock(pos: Vec3) {
    this.blocks.push(pos);
      // Determine if portal should be added or removed based on block change
    this.generatePortal = this.createPortal();
  }

  public merge(blocks: Vec3[]) {
    for (let i = 0; i < blocks.length; ++i) {
      if (!this.blockIn(blocks[i])) {
        this.blocks.push(blocks[i]);
      }
    }
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
    this.generatePortal = this.createPortal();
    return partitions;
  }

  private floodFill(start: number, visited: Set<number>): Vec3[] {
    const blocks: Vec3[] = [];
    const queue: number[] = [start];
    while (queue.length > 0) {
      const idx: number = queue[0];
      queue.shift();
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

  public setOutlet(portal2: null|Portal) {
    if (this.outlet === portal2) {
      return;
    }
    this.outlet = portal2;
    if (this.outlet === null) {
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
    let axis1 = new Vec3([bottomRight.x - topLeft.x - 1, 0, 0]);
    let axis2 = new Vec3([0, bottomRight.y - topLeft.y - 1, 0]);
    if (bottomRight.x - topLeft.x == 0) {
      axis1 = new Vec3([0, 0, bottomRight.z - topLeft.z - 1]);
      corner.y += 1;
      corner.z += 1;
    } else if (bottomRight.y - topLeft.y == 0) {
      axis2 = new Vec3([0, 0, bottomRight.z - topLeft.z - 1]);
      corner.x += 1;
      corner.z += 1;
    } else {
      corner.x += 1;
      corner.y += 1;
    }
    // Create mesh
    this.portalMesh = new PortalMesh(corner, axis1, axis2);
  }

  public activePortal() {
    return this.generatePortal;
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
  constructor(corner: Vec3, axis1: Vec3, axis2: Vec3) {
    this.positionsRay = [
      /* Front */
      new Vec4([corner.x, corner.y, corner.z, 1.0]),
      new Vec4([corner.x + axis1.x, corner.y + axis1.y, corner.z + axis1.z, 1.0]),
      new Vec4([corner.x + axis2.x, corner.y + axis2.y, corner.z + axis2.z, 1.0]),
      new Vec4([corner.x + axis2.x + axis1.x, corner.y + axis2.y + axis1.y, corner.z + axis2.z + axis1.z, 1.0])
    ]
    console.assert(this.positionsRay != null);
    console.assert(this.positionsRay.length === 4);
    this.positionsF32 = new Float32Array(this.positionsRay.length * 4);
    this.positionsRay.forEach((v: Vec4, i: number) => {
      this.positionsF32.set(v.xyzw, i * 4);
    });
    console.assert(this.positionsF32 != null);
    console.assert(this.positionsF32.length === 4 * 4);


    this.indicesRay = [
      /* Top */
      new Vec3([0, 1, 2]),
      new Vec3([1, 3, 2])
    ]
    console.assert(this.indicesRay != null);
    console.assert(this.indicesRay.length === 2);
    this.indicesU32 = new Uint32Array(this.indicesRay.length * 3);
    this.indicesRay.forEach((v: Vec3, i: number) => {
      this.indicesU32.set(v.xyz, i * 3);
    });
    console.assert(this.indicesU32 != null);
    console.assert(this.indicesU32.length === 2 * 3);

    const normal = Vec3.cross(axis1, axis2);
    this.normalsRay = [
      /* Front */
      new Vec4([normal.x, normal.y, normal.z, 0.0]),
      new Vec4([normal.x, normal.y, normal.z, 0.0]),
      new Vec4([normal.x, normal.y, normal.z, 0.0]),
      new Vec4([normal.x, normal.y, normal.z, 0.0]),
    ];
    console.assert(this.normalsRay != null);
    console.assert(this.normalsRay.length === 4);
    this.normalsF32 = new Float32Array(this.normalsRay.length * 4);
    this.normalsRay.forEach((v: Vec4, i: number) => {
      this.normalsF32.set(v.xyzw, i * 4);
    });
    console.assert(this.normalsF32 != null);
    console.assert(this.normalsF32.length === 4 * 4);

    this.uvRay = [
      /* Top */
      new Vec3([0.0, 0.0, 0.0]),
      new Vec3([0.0, 1.0, 0.0]),
      new Vec3([1.0, 1.0, 0.0]),
      new Vec3([1.0, 0.0, 0.0])
    ]
    console.assert(this.uvRay != null);
    console.assert(this.uvRay.length === 4);
    this.uvF32 = new Float32Array(this.uvRay.length * 2);
    this.uvRay.forEach((v: Vec3, i: number) => {
      this.uvF32.set(v.xy, i * 2);
    });
    console.assert(this.uvF32 != null);
    console.assert(this.uvF32.length === 4 * 2);
  }

  public positionsFlat(): Float32Array {
    // console.assert(this.positionsF32.length === 24 * 4);
    return this.positionsF32;
  }

  public indices(): Vec3[] {
    // console.assert(this.indicesRay.length === 12);
    return this.indicesRay;
  }

  public indicesFlat(): Uint32Array {
    // console.assert(this.indicesU32.length === 12 * 3);
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