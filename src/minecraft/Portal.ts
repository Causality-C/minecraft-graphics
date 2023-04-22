import {Vec3} from '../lib/TSM.js';
import {Camera} from '../lib/webglutils/Camera';


// Creates a two dimensional rectangular portal
export class Portal {
  private position: Vec3;  // center of the portal in world space
  private normal: Vec3;    // normal of face of portal, determines orientation
  private width: number;   // width of portal
  private height: number;  // height of portal
  public outlet: Portal|null;  // the portal that this portal leads to
  public blocks: Vec3[];  // Coordinates of blocks that are part of the portal
  private generatePortal: boolean;


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
    this.outlet = portal2;
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
  private normalF32: Float32Array;
  private uvF32: Float32Array;

  // We assume a 1x1 square centered at the origin
  constructor(center: Vec3) {}
}