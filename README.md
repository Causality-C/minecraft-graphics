# Computer Graphics Minecraft Project
<img width="1279" alt="image" src="https://user-images.githubusercontent.com/39445369/231509470-ac5ab3b5-e22b-4914-a04f-f2775480d60f.png">

In this project, Sid and I used value and perlin noise to proceduraly generate blocky terrain and textures as found in the popular game Minecraft. We also implemented walking, block collision, and flying.

### Required Features
- [X] Terrain Synthesis (60pts): we implemented multi-octave value noise to generate the heights of the 3x3 chunk terrain with seamless chunk boundaries. We also optimized away generating all blocks to blocks that could be visible to the player, resulting in an over 90% block reduction (~192,000 -> ~10,000 blocks). 

- [X] Procedural Textures (40pts): in our shader code we implemented Perlin noise with multiple octaves to generate smooth random textures. We created 3 different blocks: magma, stone, and snow, and had these blocks rendered based on the height of the terrain. Magma is rendered at low points, snow is rendered at high points, and stone is rendered in between. 

- [X] FPS Controls (30pts): our controls are implemented as in the assignment specification. For our collision code, we check the blocks in a 3x3 area centered around the player to check whether a inputted move is valid. If there is an intersection, we ignore the input. Additionally, we broke this logic into two parts: side collisions and vertical collisions. This ensures that if the player is jumping while running into a block, they will still be able to move. When we are at chunk boundaries we also check neighboring chunks for collisions, to ensure that we do not clip through blocks there.

### Extra Credit (40 points total)
- [X] Time-varying perlin noise (+10): we implemented time varying 2D perlin noise for our lava texture block, animating the lava for a flowing effect.

https://user-images.githubusercontent.com/84476225/231520935-67577da2-f647-449b-88b5-7df076163622.mp4


- [X] 3D Perlin noise (+20): we implemented 3D perlin noise on the CPU and augmented it with our existing value noise block height logic to generate overhangs and ravines. For each block, 3D perlin noise values above a certain threshold would indicate that the block would be drawn, biasing blocks that are lower in elevation (so that most if not all blocks below y=20 are solid). We also modified the player collision code to account for the change chunk generation logic. Note, using 3D perlin noise on CPU can result in long chunk load times and performance loss (as chunks are loaded in) so we allowed manually enabling 3D perlin noise generation by pressing the **key "P" on the keyboard**. Pressing **"P"** again will result in normal chunk generation without perlin noise.

- [X] Creative Mode (+0): this is a convenience feature to view the world from various angles. Pressing the **key "C" on the keyboard** will allow you to toggle between this and FPS mode. When in this mode, you can use **SPACE** and **LSHIFT** to fly up and down respectively. Since collision detection is turned off in this mode, ensure that you are in safe location when switching back to FPS mode.

- [X] Hysteresis Thresholding (+5): to ensure that walking back and forth across chunk boundaries does not significantly impact performance, we maintain a cache of deleted chunks which is checked before generating new chunks. This cache size is configurable in App.ts (by default it is 9, the same size as the player's set of rendered chunks).

- [X] Day Night Cycle (+5): we implemented a simple day and night cycle by making the location of the light source vary with time in a circle centered around the player. Additionally, we made the background color vary as a gradient dependent on the height of the light source to give the sky color depending on the in game time. The speed of the day/night cycle can be controlled with **LARROW** and **RARROW**, which decrease and increase the cycle time respectively by 10 seconds. The default cycle time is 60 seconds, and the minimum cycle time is 10 seconds.

### Work balance
Overall, Sid and I balanced the work out for this project evenly. Sid worked on the FPS controls, chunk loading/unloading, day-night-cycle, and hysteresis while I did most of the value noise, perlin noise, and 3D perlin noise. 

### Sources
- [Procedural Wood](https://skybase.wordpress.com/2012/01/26/how-to-creating-super-simple-procedural-wood-textures-in-filter-forge/)
- [Value Noise](https://www.ronja-tutorials.com/post/025-value-noise/#show-a-line)
- [Stack overflow brick wall](https://stackoverflow.com/questions/18758754/converting-2d-perlin-noise-into-brick-wall-texture)
- [Research Papers on generating noise and procedural generation](https://www.mdpi.com/1424-8220/20/4/1135)
- [Minecraft Generation Video](https://www.youtube.com/watch?v=CSa5O6knuwI&t=1130s&ab_channel=HenrikKniberg)
- [Trilinear Interpolation](https://en.wikipedia.org/wiki/Trilinear_interpolation#External_links)
- [Scratch a Pixel Perlin Noise](https://www.scratchapixel.com/lessons/procedural-generation-virtual-worlds/perlin-noise-part-2/perlin-noise.html)
- [L Systems for Tree Generation](https://www.youtube.com/watch?v=feNVBEPXAcE&ab_channel=SimonDev)
- [3D Perlin Noise for Caves](https://blog.danol.cz/voxel-cave-generation-using-3d-perlin-noise-isosurfaces/)
- [3D Perlin Noise Youtube Video](https://www.youtube.com/watch?v=TZFv493D7jo&ab_channel=Nova840)
- 