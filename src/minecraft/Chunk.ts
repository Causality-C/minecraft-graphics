import Rand from '../lib/rand-seed/Rand.js';
import {Mat3, Mat4, Vec3, Vec4} from '../lib/TSM.js';

export class Chunk {
  private cubes: number;  // Number of cubes that should be *drawn* each frame
  private cubePositionsF32:
      Float32Array;  // (4 x cubes) array of cube translations, in homogeneous
  // coordinates
  private x: number;  // Center of the chunk
  private y: number;
  private size: number;  // Number of cubes along each side of the chunk
  private maxHeight: number = 50;

  constructor(centerX: number, centerY: number, size: number) {
    this.x = centerX;
    this.y = centerY;
    this.size = size;
    this.cubes = size * size;
    this.generateCubes();
  }

  // Returns the index of the old cube
  private safeIndex(i: number, j: number, oldDim: number) {
    i = Math.floor(i / 2);
    j = Math.floor(j / 2);
    if (i < 0) {
      i = 0;
    } else if (i >= oldDim) {
      i = oldDim - 1;
    }
    if (j < 0) {
      j = 0;
    } else if (j >= oldDim) {
      j = oldDim - 1;
    }
    return i * oldDim + j;
  }

  private generateValueNoiseOfSize(size: number, rng: Rand, octaves: number):
      Float32Array {
    // size should be the width of the current chunk, which we will upsample and
    // interpolate
    let cubePositionsF32: Float32Array = new Float32Array(size * size);
    let scaleFactor = 1.0 / ((size / this.size) * (2 ** (octaves - 1)));
    let upsampleFactor = Math.floor(Math.log2(this.size / size));

    // First create an array of random values
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const height = Math.floor(this.maxHeight * rng.next());
        const idx = size * i + j;
        cubePositionsF32[idx] = height * scaleFactor;
      }
    }
    // Then, upsample the array
    for (let i = 0; i < upsampleFactor; i++) {
      // Create new array with 2x dimensions of first
      let oldDim = Math.sqrt(cubePositionsF32.length);
      let newDim = oldDim * 2;
      let cubePositionsF32Updated = new Float32Array((newDim) * (newDim));
      // We would like lower resolution values to have a larger effect on the
      // noise
      // Copy over old values
      for (let j = 0; j < oldDim; j++) {
        for (let k = 0; k < oldDim; k++) {
          let idx = size * j + k;
          let newIdx = newDim * (j * 2) + k * 2;
          cubePositionsF32Updated[newIdx] = cubePositionsF32[idx];
        }
      }
      // Now bilinearly interpolate with (9d + 3c + 3a + b) / 16
      for (let j = 0; j < newDim; j++) {
        for (let k = 0; k < newDim; k++) {
          // Compute indices of 4 surrounding points
          let d = this.safeIndex(j, k, oldDim);
          let c = this.safeIndex(j, k + 1, oldDim);
          let a = this.safeIndex(j + 1, k, oldDim);
          let b = this.safeIndex(j + 1, k + 1, oldDim);
          let newHeight = (9 * cubePositionsF32[d] + 3 * cubePositionsF32[c] +
                           3 * cubePositionsF32[a] + cubePositionsF32[b]) /
              16;
          let newIdx = newDim * j + k;
          cubePositionsF32Updated[newIdx] = newHeight;
        }
      }
      // Now replace old array with new array
      cubePositionsF32 = cubePositionsF32Updated;
    }
    return cubePositionsF32;
  }

  private generateCubes() {
    // Coordinate of heightmap's top-left corner
    const topleftx = this.x - this.size / 2;
    const toplefty = this.y - this.size / 2;



    // TODO: The real landscape-generation logic. The example code below shows
    // you how to use the pseudorandom number generator to create a few cubes.
    this.cubes = this.size * this.size;
    this.cubePositionsF32 = new Float32Array(4 * this.cubes);
    const seed = '42';
    let rng = new Rand(seed);

    // Create multiple layers of value noise
    let octaves = 4;
    let heightMap: Float32Array = new Float32Array(this.size * this.size);
    for (let i = 0; i < octaves; i++) {
      // Scale and blend them together to avoid overflow (heights should be
      // 0-100)
      let blockWidth: number = Math.floor((this.size) / (2 ** i));
      let noise: Float32Array =
          this.generateValueNoiseOfSize(blockWidth, rng, octaves);
      // Verify that the size of the arrays match
      // Adds the noise to the heightMap
      heightMap = heightMap.map((value: number, index: number) => {
        return value + noise[index];
      });
    }
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        const idx = this.size * i + j;
        const height = Math.floor(heightMap[idx]);
        this.cubePositionsF32[4 * idx + 0] = topleftx + j;
        this.cubePositionsF32[4 * idx + 1] = height;
        this.cubePositionsF32[4 * idx + 2] = toplefty + i;
        this.cubePositionsF32[4 * idx + 3] = 0;
      }
    }
  }

  public cubePositions(): Float32Array {
    return this.cubePositionsF32;
  }

  public numCubes(): number {
    return this.cubes;
  }
  // This will be useful for conditionally rendering chunks based on the
  // position of the camera
  public getChunkCenter(): Vec3 {
    return new Vec3([this.x, 0, this.y]);
  }
}
