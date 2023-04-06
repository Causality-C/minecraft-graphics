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
  private maxHeight: number = 40;

  constructor(centerX: number, centerY: number, size: number) {
    this.x = centerX;
    this.y = centerY;
    this.size = size;
    this.cubes = size * size;
    this.generateCubes();
  }

  // Returns the index of the old cube
  private safeIndex(i: number, j: number, oldDim: number) {
    let newi = i;
    let newj = j;

    i = Math.floor(i / 2);
    j = Math.floor(j / 2);

    // TODO: might be ass logic so we could refactor
    if (i / (oldDim - 1) > newi / ((oldDim * 2) - 1)) {
      i--;
    }
    if (i < 0) {
      i = 0;
    } else if (i >= oldDim) {
      i = oldDim - 1;
    }

    // TODO: might be ass logic so we could refactor
    if (j / (oldDim - 1) > newj / ((oldDim * 2) - 1)) {
      j--;
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
    // size should be the width of the current chunk, which we will upsample
    // and interpolate
    let cubePositionsF32: Float32Array = new Float32Array(size * size);
    let scaleFactor = (1.0 / ((size / this.size) * (2 ** (octaves - 1)))) / 2;
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

  private generateValueNoiseOfUpdatedSize(
      size: number, rng: Rand, octaves: number): Float32Array {
    // Step 1: Allocate noise array with (size + 1) x (size + 1) elements
    let paddedSize = size + 2;
    let cubePositionsF32: Float32Array = new Float32Array(paddedSize ** 2);
    let scaleFactor = (1.0 / ((size / this.size) * (2 ** (octaves - 1)))) / 2;

    // Step 2: Fill in the non-padded parts of the noise array with value
    // noise
    for (let i = 1; i < size + 1; i++) {
      for (let j = 1; j < size + 1; j++) {
        const height = Math.floor(this.maxHeight * rng.next());
        const idx = paddedSize * i + j;
        cubePositionsF32[idx] = height * scaleFactor;
      }
    }

    // Step 3: Fill in padded parts of the noise array with noise from other
    // chunks
    const seedTop = `${this.x}_${this.y - this.size}`;
    const seedBottom = `${this.x}_${this.y + this.size}`;
    const seedLeft = `${this.x - this.size}_${this.y}`;
    const seedRight = `${this.x + this.size}_${this.y}`;
    const seedBRight = `${this.x + this.size}_${this.y + this.size}`;
    const seedBLeft = `${this.x - this.size}_${this.y + this.size}`;
    const seedTRight = `${this.x + this.size}_${this.y - this.size}`;
    const seedTLeft = `${this.x - this.size}_${this.y - this.size}`;
    const seeds = [
      seedTop, seedBottom, seedLeft, seedRight, seedBRight, seedBLeft,
      seedTRight, seedTLeft
    ];
    let noiseArrays = seeds.map(seed => {
      let rng: Rand = new Rand(seed);
      let arr: Float32Array = new Float32Array(size * size);
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          const height = Math.floor(this.maxHeight * rng.next());
          const idx = size * i + j;
          arr[idx] = height * scaleFactor;
        }
      }
      return arr;
    })
    // Top
    for (let i = 1; i < size + 1; i++) {
      let idx = (size - 1) * size + (i - 1);
      cubePositionsF32[i] = noiseArrays[0][idx];
    }
    // TopLeft
    cubePositionsF32[0] = noiseArrays[7][size ** 2 - 1];
    // Bottom
    for (let i = 1; i < size + 1; i++) {
      let idx = (i - 1);
      let newIdx = (size + 1) * (size + 2) + i;
      cubePositionsF32[newIdx] = noiseArrays[1][idx];
    }

    // Left
    for (let i = 1; i < size + 1; i++) {
      // the right column of the other chunk array
      let idx = (i - 1) * size + (size - 1);
      // the left column of our current array
      let newIdx = (i) * (size + 2);
      cubePositionsF32[newIdx] = noiseArrays[2][idx];
    }

    // Right
    for (let i = 1; i < size + 1; i++) {
      // the left column of the other chunk array
      let idx = (i - 1) * size;
      // the right column of our current array
      let newIdx = (i) * (size + 2) + (size + 1);
      cubePositionsF32[newIdx] = noiseArrays[3][idx];
    }
    // Bright
    cubePositionsF32[(size + 2) ** 2 - 1] = noiseArrays[4][0];
    // BLeft
    cubePositionsF32[(size + 2) * (size + 1)] = noiseArrays[5][size - 1];

    // TRight
    cubePositionsF32[size + 1] = noiseArrays[6][size ** 2 - size];

    // Step 4: Bilinearly Interpolate the noise array repeatedly to get the
    // desired size) using uv coordintes
    let upsampleFactor = Math.floor(Math.log2(this.size / size));

    // Then, upsample the array
    for (let i = 0; i < upsampleFactor; i++) {
      // Create new array with 2x dimensions of first
      let oldDim = Math.sqrt(cubePositionsF32.length);
      let newDim = oldDim * 2;
      let cubePositionsF32Updated = new Float32Array((newDim) * (newDim));
      // We would like lower resolution values to have a larger effect on the
      // noise
      for (let j = 0; j < newDim; j++) {
        for (let k = 0; k < newDim; k++) {
          // Bilinearly interpolate
          let d_i = this.safeIndex(j, k, oldDim);
          let c_i = ((d_i % oldDim) === (oldDim - 1)) ? d_i : d_i + 1;
          let a_i = (d_i + oldDim >= oldDim ** 2) ? d_i : d_i + oldDim;
          let b_i = ((a_i % oldDim) === (oldDim - 1)) ? a_i : a_i + 1;

          let d = [
            Math.floor(d_i / oldDim) / (oldDim - 1),
            (d_i % oldDim) / (oldDim - 1)
          ];
          let c = [
            Math.floor(c_i / oldDim) / (oldDim - 1),
            (c_i % oldDim) / (oldDim - 1)
          ];
          let b = [
            Math.floor(b_i / oldDim) / (oldDim - 1),
            (b_i % oldDim) / (oldDim - 1)
          ];
          let a = [
            Math.floor(a_i / oldDim) / (oldDim - 1),
            (a_i % oldDim) / (oldDim - 1)
          ];

          // heights
          let d_h = cubePositionsF32[d_i];
          let c_h = cubePositionsF32[c_i];
          let b_h = cubePositionsF32[b_i];
          let a_h = cubePositionsF32[a_i];

          // console.log(d_i, c_i, a_i, b_i);
          // console.log(d, c, a, b);
          // console.log([j / (newDim - 1), k / (newDim - 1)]);

          // Taken from ray tracer code
          let x0 = d[0];
          let x1 = x0 + 1 / (oldDim - 1);
          let y0 = d[1];
          let y1 = y0 + 1 / (oldDim - 1);

          let x = j / (newDim - 1);
          let y = k / (newDim - 1);
          let idx = (newDim) * j + k;
          let val = (d_h * (x1 - x) * (y1 - y) + a_h * (x - x0) * (y1 - y) +
                     c_h * (x1 - x) * (y - y0) + b_h * (x - x0) * (y - y0)) *
              ((oldDim - 1) ** 2);
          // console.log(
          //     (x1 - x) * (y1 - y) * ((oldDim - 1) ** 2),
          //     (x - x0) * (y1 - y) * ((oldDim - 1) ** 2),
          //     (x1 - x) * (y - y0) * ((oldDim - 1) ** 2),
          //     (x - x0) * (y - y0) * ((oldDim - 1) ** 2));

          // Update this thing
          cubePositionsF32Updated[idx] = val;
        }
      }
      // Now replace old array with new array
      cubePositionsF32 = cubePositionsF32Updated;
    }


    // Step 5: Return the inner sections of the noise array corresponding
    // to the non-padded parts (which should be this.size x this.size)
    let sideLength = Math.floor(Math.sqrt(cubePositionsF32.length));
    let retArray: Float32Array = new Float32Array(this.size * this.size);
    let padding = (sideLength - this.size) / 2;
    for (let i = padding; i < this.size + padding; i++) {
      for (let j = padding; j < this.size + padding; j++) {
        let retIndex = (i - padding) * this.size + (j - padding);
        let idx = (i) * sideLength + (j);
        retArray[retIndex] = cubePositionsF32[idx];
      }
    }

    return retArray;
  }
  private numCubesDrawn(arr: Float32Array, i: number, j: number): number {
    const idx = this.size * i + j;
    // up
    const idxUp = this.size * (i - 1) + j;
    const idxDown = this.size * (i + 1) + j;
    const idxLeft = this.size * i + j - 1;
    const idxRight = this.size * i + j + 1;
    const heightNeigh =
        [arr[idx], arr[idxUp], arr[idxDown], arr[idxLeft], arr[idxRight]];
    const minNeigh = Math.min(...heightNeigh);

    return Math.floor(arr[idx] - minNeigh + 1);
  }

  private generateCubes() {
    // Coordinate of heightmap's top-left corner
    const topleftx = this.x - this.size / 2;
    const toplefty = this.y - this.size / 2;

    // TODO: The real landscape-generation logic. The example code below shows
    // you how to use the pseudorandom number generator to create a few cubes.
    this.cubes = this.size * this.size;
    // this.cubePositionsF32 = new Float32Array(4 * this.cubes);
    const seed = `${topleftx}_${toplefty}`;
    let rng = new Rand(seed);

    // Create multiple layers of value noise
    let octaves = 6;
    let heightMap: Float32Array = new Float32Array(this.size * this.size);
    for (let i = 0; i < octaves; i++) {
      // Scale and blend them together to avoid overflow (heights should be
      // 0-100)
      let blockWidth: number = Math.floor((this.size) / (2 ** i));
      let noise: Float32Array =
          this.generateValueNoiseOfSize(blockWidth, rng, octaves);
      let something: Float32Array =
          this.generateValueNoiseOfUpdatedSize(blockWidth, rng, octaves);
      // Verify that the size of the arrays match
      // Adds the noise to the heightMap
      heightMap = heightMap.map((value: number, index: number) => {
        return value + noise[index];
      });
    }
    // Analyze height map and render more cubes with the appropriate heights
    // TODO: move this logic outside of the chunk class
    let totalCubes = 0;
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        const idx = this.size * i + j;
        const height = Math.floor(heightMap[idx]);
        if (i !== 0 && j !== 0 && i !== this.size - 1 && j !== this.size - 1) {
          // Only render the cubes that are on and above the minimum neighbor
          totalCubes += this.numCubesDrawn(heightMap, i, j);
        } else {
          // If we are on the edge, we want to render the cube
          // TODO: logic to not render if there is a neighbor chunk
          totalCubes += height;
        }
      }
    }
    this.cubes = totalCubes;
    this.cubePositionsF32 = new Float32Array(4 * totalCubes);
    let pos = 0;
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        const idx = this.size * i + j;
        const height = Math.floor(heightMap[idx]);
        if (i !== 0 && j !== 0 && i !== this.size - 1 && j !== this.size - 1) {
          const numCubes = this.numCubesDrawn(heightMap, i, j);
          for (let k = 0; k < numCubes; k++) {
            this.cubePositionsF32[4 * pos + 0] = topleftx + j;
            this.cubePositionsF32[4 * pos + 1] = height - k;
            this.cubePositionsF32[4 * pos + 2] = toplefty + i;
            this.cubePositionsF32[4 * pos + 3] = 0;
            pos++;
          }
        } else {
          for (let k = 0; k < height; k++) {
            this.cubePositionsF32[4 * pos + 0] = topleftx + j;
            this.cubePositionsF32[4 * pos + 1] = height - k;
            this.cubePositionsF32[4 * pos + 2] = toplefty + i;
            this.cubePositionsF32[4 * pos + 3] = 0;
            pos++;
          }
        }
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
