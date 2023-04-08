import {Config} from './App.js';
import Rand from '../lib/rand-seed/Rand.js';
import {Mat3, Mat4, Vec2, Vec3, Vec4} from '../lib/TSM.js';

export class Chunk {
  private cubes: number;  // Number of cubes that should be *drawn* each frame
  private cubePositionsF32:
      Float32Array;  // (4 x cubes) array of cube translations, in homogeneous
  // coordinates
  private x: number;  // Center of the chunk
  private y: number;
  private size: number;  // Number of cubes along each side of the chunk
  private maxHeight: number = 40;
  private heightMap: Float32Array;

  constructor(centerX: number, centerY: number, size: number) {
    this.x = centerX;
    this.y = centerY;
    this.size = size;
    this.cubes = size * size;
    this.generateCubes();
  }

  public verticalCollision(cameraLocation: Vec3): number {
    const topleftx = this.x - this.size / 2;
    const toplefty = this.y - this.size / 2;
    const base: number = cameraLocation.y - Config.PLAYER_HEIGHT;
    const x = Math.round(cameraLocation.x - topleftx);
    const y = Math.round(cameraLocation.z - toplefty);
    if (x >= 0 && y >= 0 && x < this.size && y < this.size) {
        const height = Math.floor(this.heightMap[x * this.size + y]);
        if (base < height) {
            return height;
        }
    }
    return Number.MIN_SAFE_INTEGER;
  }

  public sideCollision(cameraLocation: Vec3): boolean {
    // console.log(cameraLocation.x + " " + cameraLocation.z);
    const topleftx = this.x - this.size / 2;
    const toplefty = this.y - this.size / 2;
    const base: number = cameraLocation.y - Config.PLAYER_HEIGHT;
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            let point: Vec2 = new Vec2([i == 0 ? cameraLocation.x : Math.round(cameraLocation.x) - 0.5 + i,
                                        j == 0 ? cameraLocation.z : Math.round(cameraLocation.z) - 0.5 + j]);
            point.add(new Vec2([i == -1 ? 1 : 0, j == -1 ? 1 : 0]))
            let distance = Vec2.distance(point, new Vec2([cameraLocation.x, cameraLocation.z]));
            // console.log(i + "," + j + " : " + distance)
            if (distance < Config.PLAYER_RADIUS) {
                const x = Math.round(cameraLocation.x - topleftx) + i;
                const y = Math.round(cameraLocation.z - toplefty) + j;
                if (x >= 0 && y >= 0 && x < this.size && y < this.size) {
                    const height = Math.floor(this.heightMap[x * this.size + y]);
                    if (base < height) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
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


  private apply2x2KernelToSquareMatrix(
      kernel: Float32Array, matrix: Float32Array): Float32Array {
    let matrixDim = Math.floor(Math.sqrt(matrix.length));
    if (matrixDim ** 2 !== matrix.length) {
      throw new Error('Matrix is not square');
    } else {
      // New matrix dim is one less than old matrix dim
      matrixDim--;
    }
    let filteredMatrix = new Float32Array(matrixDim * matrixDim);
    // Apply Kernel
    for (let i = 0; i < matrixDim; i++) {
      for (let j = 0; j < matrixDim; j++) {
        let newIdx = matrixDim * i + j;
        let idx = (matrixDim + 1) * i + j;
        let nextIdx = (matrixDim + 1) * (i + 1) + j;
        filteredMatrix[newIdx] = kernel[0] * matrix[idx] +
            kernel[1] * matrix[idx + 1] + kernel[2] * matrix[nextIdx] +
            kernel[3] * matrix[nextIdx + 1];
        filteredMatrix[newIdx] /= 16;
      }
    }
    return filteredMatrix;
  }
  private generateValueNoiseOfUpdatedSize(size: number, octaves: number):
      Float32Array {
    // Step 1: Allocate noise array with (size + 1) x (size + 1) elements
    let seed = `${this.x}_${this.y}_${size}`;
    let rng: Rand = new Rand(seed);
    let paddedSize = size + 2;
    let cubePositionsF32: Float32Array = new Float32Array(paddedSize ** 2);
    let scaleFactor = (1.0 / ((size / this.size) * (2 ** (octaves - 1)))) / 2;
    let upsampleFactor = Math.floor(Math.log2(this.size / size));

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
    const seedTop = `${this.x - this.size}_${this.y}_${size}`;
    const seedBottom = `${this.x + this.size}_${this.y}_${size}`;
    const seedLeft = `${this.x}_${this.y - this.size}_${size}`;
    const seedRight = `${this.x}_${this.y + this.size}_${size}`;
    const seedBRight = `${this.x + this.size}_${this.y + this.size}_${size}`;
    const seedBLeft = `${this.x + this.size}_${this.y - this.size}_${size}`;
    const seedTRight = `${this.x - this.size}_${this.y + this.size}_${size}`;
    const seedTLeft = `${this.x - this.size}_${this.y - this.size}_${size}`;
    const seeds = [
      seedTop, seedBottom, seedLeft, seedRight, seedBRight, seedBLeft,
      seedTRight, seedTLeft
    ];
    let noiseArrays = seeds.map(seed => {
      // Generate RNG at the same layer
      let newRNG: Rand = new Rand(seed);
      let arr: Float32Array = new Float32Array(size * size);
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          const height = Math.floor(this.maxHeight * newRNG.next());
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

    // Create interpolation filters of 9 3 3 1
    let tLeft = new Float32Array([9, 3, 3, 1]);
    let tRight = new Float32Array([3, 9, 1, 3]);
    let bLeft = new Float32Array([3, 1, 9, 3]);
    let bRight = new Float32Array([1, 3, 3, 9]);

    // Then, upsample the array
    for (let i = 0; i < upsampleFactor; i++) {
      // Create new array with 2x dimensions of first
      let oldDim = Math.sqrt(cubePositionsF32.length);
      let newDim = (oldDim - 2) * 2 + 2;
      let cubePositionsF32Updated = new Float32Array((newDim) * (newDim));
      // Convolution Matrix with 2x2 kernels does bilinear interpolation cleanly
      let tLeftMat = this.apply2x2KernelToSquareMatrix(tLeft, cubePositionsF32);
      let tRightMat =
          this.apply2x2KernelToSquareMatrix(tRight, cubePositionsF32);
      let bLeftMat = this.apply2x2KernelToSquareMatrix(bLeft, cubePositionsF32);
      let bRightMat =
          this.apply2x2KernelToSquareMatrix(bRight, cubePositionsF32);

      let matLen = Math.sqrt(bLeftMat.length);
      for (let j = 0; j < newDim; j++) {
        for (let k = 0; k < newDim; k++) {
          let idx = j * newDim + k;
          let idxj = Math.floor(j / 2);
          let idxk = Math.floor(k / 2);
          let value = 0;
          // Use different kernels depending on whether j and k are even or odd
          if (j % 2 === 0 && k % 2 === 0) {
            value = tLeftMat[idxj * matLen + idxk];
          } else if (j % 2 === 0 && k % 2 === 1) {
            value = tRightMat[idxj * matLen + idxk];
          } else if (j % 2 === 1 && k % 2 === 0) {
            value = bLeftMat[idxj * matLen + idxk];
          } else {
            value = bRightMat[idxj * matLen + idxk];
          }
          cubePositionsF32Updated[idx] = value;
        }
      }
      // Now replace old array with new array
      cubePositionsF32 = cubePositionsF32Updated;
    }


    // Step 5: Return the inner sections of the noise array corresponding
    // to the non-padded parts (which should be this.size x this.size)
    let retArray: Float32Array = new Float32Array(this.size * this.size);
    for (let i = 1; i < this.size + 1; i++) {
      for (let j = 1; j < this.size + 1; j++) {
        let retIndex = (i - 1) * this.size + (j - 1);
        let idx = (i) * (this.size + 2) + (j);

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
    // const seed = `${topleftx}_${toplefty}`;
    // let rng = new Rand(seed);

    // Create multiple layers of value noise
    let octaves = 6;
    this.heightMap = new Float32Array(this.size * this.size);
    for (let i = 0; i < octaves; i++) {
      // Scale and blend them together to avoid overflow (heights should be
      // 0-100)
      let blockWidth: number = Math.floor((this.size) / (2 ** i));
      let something: Float32Array =
          this.generateValueNoiseOfUpdatedSize(blockWidth, octaves);

      // Verify that the size of the arrays match
      // Adds the noise to the this.heightMap
      this.heightMap = this.heightMap.map((value: number, index: number) => {
        return value + something[index];
      });
    }
    // Analyze height map and render more cubes with the appropriate heights
    // TODO: move this logic outside of the chunk class
    let totalCubes = 0;
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        const idx = this.size * i + j;
        const height = Math.floor(this.heightMap[idx]);
        if (i !== 0 && j !== 0 && i !== this.size - 1 && j !== this.size - 1) {
          // Only render the cubes that are on and above the minimum neighbor
          totalCubes += this.numCubesDrawn(this.heightMap, i, j);
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
        const height = Math.floor(this.heightMap[idx]);
        if (i !== 0 && j !== 0 && i !== this.size - 1 && j !== this.size - 1) {
          const numCubes = this.numCubesDrawn(this.heightMap, i, j);
          for (let k = 0; k < numCubes; k++) {
            // Changed cube orientation so that x is i and y is j
            this.cubePositionsF32[4 * pos + 0] = topleftx + i;
            this.cubePositionsF32[4 * pos + 1] = height - k;
            this.cubePositionsF32[4 * pos + 2] = toplefty + j;
            this.cubePositionsF32[4 * pos + 3] = 0;
            pos++;
          }
        } else {
          for (let k = 0; k < height; k++) {
            // Changed cube orientation so that x is i and y is j
            this.cubePositionsF32[4 * pos + 0] = topleftx + i;
            this.cubePositionsF32[4 * pos + 1] = height - k;
            this.cubePositionsF32[4 * pos + 2] = toplefty + j;
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
