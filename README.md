# Computer Graphics Minecraft Project
<img width="1279" alt="image" src="https://user-images.githubusercontent.com/39445369/231509470-ac5ab3b5-e22b-4914-a04f-f2775480d60f.png">

In this project, Sid and I used value and perlin noise to proceduraly generate blocky terrain and textures as found in the popular game Minecraft. We also implemented walking, block collision, and flying.

### Required Features
- [X] Terrain Synthesis (60pts) : we implemented multi-octave value noise to generate the heights of the 3x3 chunk terrain with seamless chunk boundaries. We also optimized away generating all blocks to blocks that could be visible to the player, resulting in an over 90% block reduction (~192,000 -> ~10,000 blocks). 

- [X] Procedural Textures (40pts):

- [X] FPS Controls (30pts):

### Extra Credit
- [X] Time-varying perlin noise (+10): we implemented time varying 2D perlin noise for our lava texture block, animating the lava for a flowing effect.

- [X] 3D Perlin noise (+20): we implemented 3D perlin noise on the CPU and augmented it with our existing value noise block height logic to generate overhangs and ravines. For each block, 3D perlin noise values above a certain threshold would indicate that the block would be drawn, biasing blocks that are lower in elevation (so that most if not all blocks below y=20 are solid). We also modified the player collision code to account for the change chunk generation logic. Note, using 3D perlin noise on CPU can result in long chunk load times and performance loss (as chunks are loaded in) so we allowed manually enabling 3D perlin noise generation by pressing the **key "P" on the keyboard**. Pressing **"P"** again will result in normal chunk generation without perlin noise.

-[X] Creative Mode (+0): 

-[X] Hysteresis Thresholding (+5): 

-[X] Day Night Cycle (+5):

### Work balance
Overall, Sid and I balanced the work out for this project evenly. Sid worked on the FPS controls, chunk loading/unloading, day-night-cycle, and hysteresis while I did most of the value noise, perlin noise, and 3D perlin noise. 
