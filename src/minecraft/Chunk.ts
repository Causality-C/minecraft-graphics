import Rand from '../lib/rand-seed/Rand.js';
import {Mat3, Mat4, Vec2, Vec3, Vec4} from '../lib/TSM.js';

import {Config} from './App.js';
import {Portal} from './Portal.js';

export class Chunk {
  private cubes: number;  // Number of cubes that should be *drawn* each frame
  private cubePositionsF32:
      Float32Array;  // (4 x cubes) array of cube translations, in homogeneous
  // coordinates
  private x: number;  // Center of the chunk
  private y: number;
  private topleftx: number;
  private toplefty: number;
  private bottomrightx: number;
  private bottomrighty: number;
  private size: number;  // Number of cubes along each side of the chunk
  private heightMap: Float32Array;
  private densityMap: Object;  // Used for 3D perlin noise
  private maxHeight: number = 100;
  private unitVecs: Object;

  private highlightedCubePos: number;

  constructor(centerX: number, centerY: number, size: number) {
    this.x = centerX;
    this.y = centerY;
    this.size = size;
    this.topleftx = this.x - this.size / 2;
    this.toplefty = this.y - this.size / 2;
    this.bottomrightx = this.x + this.size / 2;
    this.bottomrighty = this.y + this.size / 2;
    this.cubes = size * size;
    this.heightMap = new Float32Array(this.size * this.size);
    this.unitVecs = {};
    // Cube generation logic called on initialization
    this.generateCubes();
    this.highlightedCubePos = 0;
  }
  private isInChunkBounds(x: number, y: number): boolean {
    return this.topleftx <= x && x < this.bottomrightx && this.toplefty <= y &&
        y < this.bottomrighty
  }

  public verticalCollision(cameraLocation: Vec3, upwards: boolean): number {
    const base: number = Math.round(cameraLocation.y - Config.PLAYER_HEIGHT);
    const top: number = Math.round(cameraLocation.y);
    const x = Math.round(cameraLocation.x - this.topleftx);
    const y = Math.round(cameraLocation.z - this.toplefty);
    if (x >= 0 && y >= 0 && x < this.size && y < this.size) {
      let idx = x * this.size + y;
      if (upwards) {
        for (let i = 0; i <= Config.PLAYER_HEIGHT; i++) {
          if (base + i + 1 < this.densityMap[idx].length &&
              this.densityMap[idx][base + i + 1] >= 0) {
            return base + i - Config.PLAYER_HEIGHT - 0.5;
          }
        }
      } else {
        for (let i = 0; i <= Config.PLAYER_HEIGHT; i++) {
          if (top - i < this.densityMap[idx].length &&
              this.densityMap[idx][top - i] >= 0) {
            return top - i + 0.5;
          }
        }
      }
    }
    return Number.MIN_SAFE_INTEGER;
  }

  public sideCollision(cameraLocation: Vec3): boolean {
    const top: number = Math.round(cameraLocation.y);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        let point: Vec2 = new Vec2([
          i == 0 ? cameraLocation.x : Math.round(cameraLocation.x) - 0.5 + i,
          j == 0 ? cameraLocation.z : Math.round(cameraLocation.z) - 0.5 + j
        ]);
        point.add(new Vec2([i == -1 ? 1 : 0, j == -1 ? 1 : 0]))
        let distance = Vec2.distance(
            point, new Vec2([cameraLocation.x, cameraLocation.z]));
        if (distance < Config.PLAYER_RADIUS) {
          const x = Math.round(cameraLocation.x - this.topleftx) + i;
          const y = Math.round(cameraLocation.z - this.toplefty) + j;
          if (x >= 0 && y >= 0 && x < this.size && y < this.size) {
            let idx = x * this.size + y;
            for (let k = 0; k <= Config.PLAYER_HEIGHT; k++) {
              if (top - k < this.densityMap[idx].length &&
                  this.densityMap[idx][top - k] >= 0) {
                return true;
              }
            }
          }
        }
      }
    }
    return false;
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

  private shouldDrawBasedOnDensity(i: number, j: number, k: number): boolean {
    // TODO: Should be within bounds
    let idx = this.size * i + j;
    if (k > this.densityMap[idx].length || this.densityMap[idx][k] < 0) {
      // Return false if air
      return false;
    }
    // Assume not air
    let idxUp = this.size * (i - 1) + j;
    let idxDown = this.size * (i + 1) + j;
    if (this.densityMap[idxUp][k] >= 0 && this.densityMap[idxDown][k] >= 0 &&
        this.densityMap[idx][k - 1] >= 0 && this.densityMap[idx][k + 1] >= 0 &&
        this.densityMap[idx + 1][k] >= 0 && this.densityMap[idx - 1][k] >= 0) {
      return false;
    }
    return true;
  }


  // Generates a psuedorandom 3D vector
  private unit_vec3d(x: number, y: number, z: number): Vec3 {
    // Used memoixed vectors if they exist
    let seed: string = `${x}-${y}-${z}`;
    if (seed in this.unitVecs) {
      return this.unitVecs[seed];
    }
    let rng: Rand = new Rand(seed);
    let a = 2.0 * 3.1415926 * rng.next();
    let b = 2.0 * 3.1415926 * rng.next();
    let c = 2.0 * 3.1415926 * rng.next();
    let vec: Vec3 = new Vec3([Math.cos(a), Math.sin(b), Math.cos(c)]);
    // Memoize the vector
    vec.normalize();
    this.unitVecs[seed] = vec;
    return vec;
  }

  // Bi-Cubic interpolation
  private smoothmix(a0: number, a1: number, w: number): number {
    return (a1 - a0) * (3.0 - w * 2.0) * w * w + a0;
  }

  // CPU based 3D Perlin noise
  private perlinDensity(gridSpace: number, coord: Vec3): number {
    // Compare 3d coordinate to UV coordinate
    let x0 = Math.floor(coord.x / gridSpace) * gridSpace;
    let x1 = x0 + gridSpace;
    let y0 = Math.floor(coord.y / gridSpace) * gridSpace;
    let y1 = y0 + gridSpace;
    let z0 = Math.floor(coord.z / gridSpace) * gridSpace;
    let z1 = z0 + gridSpace;

    // Get the distance between the coordinate and the surrounding points
    let xd = (coord.x - x0) / (x1 - x0);
    let yd = (coord.y - y0) / (y1 - y0);
    let zd = (coord.z - z0) / (z1 - z0);

    // Get the 8 surrounding points in the perlin grid
    let p000: Vec3 = new Vec3([x0, y0, z0]);
    let p001: Vec3 = new Vec3([x0, y0, z1]);
    let p010: Vec3 = new Vec3([x0, y1, z0]);
    let p011: Vec3 = new Vec3([x0, y1, z1]);
    let p100: Vec3 = new Vec3([x1, y0, z0]);
    let p101: Vec3 = new Vec3([x1, y0, z1]);
    let p110: Vec3 = new Vec3([x1, y1, z0]);
    let p111: Vec3 = new Vec3([x1, y1, z1]);

    // Get unit vectors to interpolate between
    let v000: Vec3 = this.unit_vec3d(p000.x, p000.y, p000.z);
    let v001: Vec3 = this.unit_vec3d(p001.x, p001.y, p001.z);
    let v010: Vec3 = this.unit_vec3d(p010.x, p010.y, p010.z);
    let v011: Vec3 = this.unit_vec3d(p011.x, p011.y, p011.z);
    let v100: Vec3 = this.unit_vec3d(p100.x, p100.y, p100.z);
    let v101: Vec3 = this.unit_vec3d(p101.x, p101.y, p101.z);
    let v110: Vec3 = this.unit_vec3d(p110.x, p110.y, p110.z);
    let v111: Vec3 = this.unit_vec3d(p111.x, p111.y, p111.z);

    let afin000: number =
        Vec3.dot(Vec3.difference(coord, p000).scale(1.0 / gridSpace), v000);
    let afin001: number =
        Vec3.dot(Vec3.difference(coord, p001).scale(1.0 / gridSpace), v001);
    let afin010: number =
        Vec3.dot(Vec3.difference(coord, p010).scale(1.0 / gridSpace), v010);
    let afin011: number =
        Vec3.dot(Vec3.difference(coord, p011).scale(1.0 / gridSpace), v011);
    let afin100: number =
        Vec3.dot(Vec3.difference(coord, p100).scale(1.0 / gridSpace), v100);
    let afin101: number =
        Vec3.dot(Vec3.difference(coord, p101).scale(1.0 / gridSpace), v101);
    let afin110: number =
        Vec3.dot(Vec3.difference(coord, p110).scale(1.0 / gridSpace), v110);
    let afin111: number =
        Vec3.dot(Vec3.difference(coord, p111).scale(1.0 / gridSpace), v111);


    // Trilinearly interpolate on X, Y, Z to get noise value
    let c00 = this.smoothmix(afin000, afin100, xd);
    let c01 = this.smoothmix(afin001, afin101, xd);
    let c10 = this.smoothmix(afin010, afin110, xd);
    let c11 = this.smoothmix(afin011, afin111, xd);
    let c0 = this.smoothmix(c00, c10, yd);
    let c1 = this.smoothmix(c01, c11, yd);
    let c = this.smoothmix(c0, c1, zd);

    // Add bias towards lower heights so we dont fall through the ground
    return c * 0.5;
  }

  private generateCubes() {
    // TODO: The real landscape-generation logic. The example code below shows
    // you how to use the pseudorandom number generator to create a few cubes.
    this.cubes = this.size * this.size;

    // TODO: 3D perlin noise for density values for cave terrain
    // Create multiple layers of value noise
    let octaves = 6;
    for (let i = 3; i < octaves; i++) {
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

    for (let i = 0; i < this.size * this.size; ++i) {
      this.heightMap[i] = 50;
    }
    
    // Generate density map for chunk
    let densityMap = {};
    let totalCubes = 0;
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        const idx = this.size * i + j;
        const height = Math.floor(this.heightMap[idx]);
        let lastHeight = 0;
        densityMap[idx] = new Float32Array(height);
        for (let k = 0; k < height; k++) {
          // Single octave 3D perlin noise
          let curPos = new Vec3([this.topleftx + i, this.toplefty + j, k]);
          densityMap[idx][k] =
              Config.PERLIN_3D ? this.perlinDensity(32, curPos) : 1;
          // Add a bias towrds lower heights being less likely to be air
          densityMap[idx][k] += 0.8 * ((40 - k) / 100);
          lastHeight = (densityMap[idx][k] > 0.0) ? k : lastHeight;
        }
        // Update height if noise removed some blocks
        this.heightMap[idx] = lastHeight + 1;
      }
    }
    // Use density map to check if we should render a cube
    this.densityMap = densityMap;
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        const idx = this.size * i + j;
        const height = Math.floor(this.heightMap[idx]);
        for (let k = 0; k < height; k++) {
          if (i !== 0 && j !== 0 && i !== this.size - 1 &&
              j !== this.size - 1 && k !== height - 1 && k !== 0) {
            // Check 6 neighbors and see if they are solid or not
            let shouldDraw = this.shouldDrawBasedOnDensity(i, j, k);
            totalCubes = (shouldDraw) ? totalCubes + 1 : totalCubes;
          } else {
            totalCubes++;
          }
        }
      }
    }


    // Suboptimal rendering
    this.cubePositionsF32 = new Float32Array(4 * totalCubes);
    this.cubes = totalCubes;
    let pos = 0;
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        const idx = this.size * i + j;
        const height = Math.floor(this.heightMap[idx]);

        for (let k = 0; k < height; k++) {
          // Only render if the cube is not air and does not have 6 blocks
          // covering it
          if (i !== 0 && j !== 0 && i !== this.size - 1 &&
              j !== this.size - 1 && k !== height - 1 && k !== 0) {
            let shouldDraw = this.shouldDrawBasedOnDensity(i, j, k);
            if (shouldDraw) {
              this.cubePositionsF32[4 * pos] = this.topleftx + i;
              this.cubePositionsF32[4 * pos + 1] = k;
              this.cubePositionsF32[4 * pos + 2] = this.toplefty + j;
              this.cubePositionsF32[4 * pos + 3] = 0;
              pos++;
            }
          }

          // Only draw if the cube is not air
          else if (densityMap[idx][k] >= 0) {
            this.cubePositionsF32[4 * pos] = this.topleftx + i;
            this.cubePositionsF32[4 * pos + 1] = k;
            this.cubePositionsF32[4 * pos + 2] = this.toplefty + j;
            this.cubePositionsF32[4 * pos + 3] = 0;
            pos++;
          }
        }
      }
    }
  }

  // Returns if a cube is in the chunk and highlights it if it is
  public updateSelected(
      highlightOn: boolean, selectedCube: Vec3, isPortal: boolean, portals: Portal[]): boolean {
    // Is this a portal block?

    // Reset the previously highlighted box
    // if (this.highlightedCubePos < this.cubes) {
    //   this.cubePositionsF32[4 * this.highlightedCubePos + 3] = 0.0;
    // }
    let highlightBlock = new Vec3([
      this.cubePositionsF32[4 * this.highlightedCubePos],
      this.cubePositionsF32[4 * this.highlightedCubePos + 1],
      this.cubePositionsF32[4 * this.highlightedCubePos + 2]
    ]);

    if (this.highlightedCubePos < this.cubes) {
      this.cubePositionsF32[4 * this.highlightedCubePos + 3] = 0.0;
      for (let i = 0; i < portals.length; ++i) {
        if (portals[i].blockIn(highlightBlock)) {
          this.cubePositionsF32[4 * this.highlightedCubePos + 3] = 5.0;
        }
      }
    }
    // Do not highlight if highlighting is turned off
    if (!highlightOn) {
      return false;
    }
    // See if the selected box is in the current chunk
    if (!this.isInChunkBounds(selectedCube.x, selectedCube.z)) {
      return false;
    }
    // Find if the cube is rendered in the current chunk and highlight if so
    for (let i = 0; i < this.cubes; ++i) {
      if (this.cubePositionsF32[4 * i] == selectedCube.x &&
          this.cubePositionsF32[4 * i + 1] == selectedCube.y &&
          this.cubePositionsF32[4 * i + 2] == selectedCube.z) {
        this.cubePositionsF32[4 * i + 3] = 3;  // Highlight
        this.highlightedCubePos = i;
        // if (selectedCube) {
        //   this.cubePositionsF32[4 * i + 3] = 5;
        // }
        return true;
      }
    }
    return false;
  }

  public updateLandscape(removeCube: boolean, selectedCube: Vec3, portals: Portal[]) {
    // See if the selected box is in the current chunk
    if (!this.isInChunkBounds(selectedCube.x, selectedCube.z)) {
      return false;
    }

    // Update number of cubes
    let updatedCubes = this.cubes + (removeCube ? -1 : 1);

    // Copy cube positions into updated array with the selected cube either
    // added or removed
    let updatedPositionsF32 = new Float32Array(4 * updatedCubes);
    let blockIdx = 0;
    for (let i = 0; i < this.cubes; ++i) {
      // If cube is set to be removed, we skip it
      if (removeCube && this.cubePositionsF32[4 * i] == selectedCube.x &&
          this.cubePositionsF32[4 * i + 1] == selectedCube.y &&
          this.cubePositionsF32[4 * i + 2] == selectedCube.z) {
        // Remove the cube
        let idx = (selectedCube.x - this.topleftx) * this.size +
            (selectedCube.z - this.toplefty);
        this.densityMap[idx][selectedCube.y] = -1.0;
        continue;
      }
      // Else we copy the cube position into the updated array
      updatedPositionsF32[4 * blockIdx] = this.cubePositionsF32[4 * i];
      updatedPositionsF32[4 * blockIdx + 1] = this.cubePositionsF32[4 * i + 1];
      updatedPositionsF32[4 * blockIdx + 2] = this.cubePositionsF32[4 * i + 2];
      updatedPositionsF32[4 * blockIdx + 3] = this.cubePositionsF32[4 * i + 3];
      ++blockIdx;
    }
    // We add a new cube
    if (!removeCube) {
      updatedPositionsF32[4 * blockIdx] = selectedCube.x;
      updatedPositionsF32[4 * blockIdx + 1] = selectedCube.y;
      updatedPositionsF32[4 * blockIdx + 2] = selectedCube.z;
      updatedPositionsF32[4 * blockIdx + 3] = 0.0;
      for (let i = 0; i < portals.length; ++i) {
        if (portals[i].blockIn(selectedCube)) {
          this.cubePositionsF32[4 * blockIdx + 3] = 5.0;
        }
      }
      // console.log('FILLING');

      this.highlightedCubePos = blockIdx;
      // Update height map and density map if we add a cube
      let idx = (selectedCube.x - this.topleftx) * this.size +
          (selectedCube.z - this.toplefty);
      let height = this.heightMap[idx];
      // This is the case where we add a cube on top of the current height
      if (selectedCube.y >= height) {
        // We're building even higher than the current height
        let densArr = [...this.densityMap[idx]];
        for (let i = 0; i < selectedCube.y - height; ++i) {
          densArr.push(-1.0);
        }
        densArr.push(1.0);
        this.densityMap[idx] = new Float32Array(densArr);
        this.heightMap[idx] = densArr.length;
      } else {
        this.densityMap[idx][selectedCube.y] = 1.0;
      }
    }

    // Update internal data structures
    this.cubePositionsF32 = updatedPositionsF32;
    this.cubes = updatedCubes;
  }

  public updateFromLog(modificationLog: number[][]) {
    // Get the modifications for the current the current chunk
    let removeCubes = {};
    let addCubes: number[][] = [];
    let modification = false;
    let updatedCubes = this.cubes;
    for (let i = 0; i < modificationLog.length; ++i) {
      const x = modificationLog[i][0];
      const y = modificationLog[i][1];
      const z = modificationLog[i][2];
      if (this.isInChunkBounds(x, z)) {
        modification = true;
        if (modificationLog[i][3] < 0) {
          if (!(x in removeCubes)) {
            removeCubes[x] = {};
          }
          if (!(y in removeCubes[x])) {
            removeCubes[x][y] = {};
          }
          if (!(z in removeCubes[x][y])) {
            removeCubes[x][y][z] = modificationLog[i][3];
            updatedCubes += modificationLog[i][3];
          }
        } else {
          addCubes.push([x, y, z]);
          updatedCubes += modificationLog[i][3];
        }
      }
    }
    if (!modification) {
      return;
    }

    // Copy cube positions into updated array with the selected cube either
    // added or removed
    let updatedPositionsF32 = new Float32Array(4 * updatedCubes);
    let blockIdx = 0;
    // Render cubes that are not removed
    for (let i = 0; i < this.cubes; ++i) {
      let x = this.cubePositionsF32[4 * i];
      let y = this.cubePositionsF32[4 * i + 1];
      let z = this.cubePositionsF32[4 * i + 2];
      // Removed Cubes
      if (x in removeCubes && y in removeCubes[x] && z in removeCubes[x][y]) {
        // Update collision logic to remove cube
        let idx = (x - this.topleftx) * this.size + (z - this.toplefty);
        this.densityMap[idx][y] = -1.0;
        continue;
      }
      updatedPositionsF32[4 * blockIdx] = this.cubePositionsF32[4 * i];
      updatedPositionsF32[4 * blockIdx + 1] = this.cubePositionsF32[4 * i + 1];
      updatedPositionsF32[4 * blockIdx + 2] = this.cubePositionsF32[4 * i + 2];
      updatedPositionsF32[4 * blockIdx + 3] = this.cubePositionsF32[4 * i + 3];
      ++blockIdx;
    }
    // Cubes to add
    for (let i = 0; i < addCubes.length; ++i) {
      updatedPositionsF32[4 * blockIdx] = addCubes[i][0];
      updatedPositionsF32[4 * blockIdx + 1] = addCubes[i][1];
      updatedPositionsF32[4 * blockIdx + 2] = addCubes[i][2];
      updatedPositionsF32[4 * blockIdx + 3] = 0;
      ++blockIdx;

      // Update collision logic to add cube
      const x = Math.round(addCubes[i][0] - this.topleftx);
      const z = Math.round(addCubes[i][2] - this.toplefty);
      let idx = x * this.size + z;

      const y = addCubes[i][1];
      let height = this.heightMap[idx];
      // This is the case where we add a cube on top of the current height

      if (y >= height) {
        // We're building even higher than the current height
        let densArr = [...this.densityMap[idx]];
        for (let i = 0; i < y - height; ++i) {
          densArr.push(-1.0);
        }
        densArr.push(1.0);
        this.densityMap[idx] = new Float32Array(densArr);
        this.heightMap[idx] = densArr.length;
      } else {
        this.densityMap[idx][y] = 1.0;
      }
    }
    // Update internal data structures
    this.cubePositionsF32 = updatedPositionsF32;
    this.cubes = updatedCubes;
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
