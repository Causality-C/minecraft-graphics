

float smoothmix(float a0, float a1, float w) {
  return (a1 - a0) * (3.0 - w * 2.0) * w * w + a0;
}

float random(in vec2 pt, in float seed) {
  return fract(sin((seed + dot(pt.xy, vec2(12.9898, 78.233)))) * 43758.5453123);
}

vec2 unit_vec(in vec2 xy, in float seed) {
  float theta = 6.28318530718 * random(xy, seed);
  return vec2(cos(theta), sin(theta));
}
float perlin(float seed, vec2 uv, float gridSpace, float normal) {
  // Dimensionality of grid
  vec2 gsv = uv * gridSpace; // gridspace vec

  // Four Coordinates around
  float x0 = floor(gsv.x);
  float x1 = x0 + 1.0;
  float y0 = floor(gsv.y);
  float y1 = y0 + 1.0;

  vec2 uv00 = vec2(x0, y0);
  vec2 uv10 = vec2(x1, y0);
  vec2 uv01 = vec2(x0, y1);
  vec2 uv11 = vec2(x1, y1);

  // Four Unit vectors to interpolate between
  vec2 vecuv00 = unit_vec(uv00, seed);
  vec2 vecuv10 = unit_vec(uv10, seed);
  vec2 vecuv01 = unit_vec(uv01, seed);
  vec2 vecuv11 = unit_vec(uv11, seed);

  // Compute dot products of vectors
  float affin00 = dot(gsv - uv00, vecuv00);
  float affin01 = dot(gsv - uv01, vecuv01);
  float affin10 = dot(gsv - uv10, vecuv10);
  float affin11 = dot(gsv - uv11, vecuv11);

  // Bicubic interpolation with smoothmix
  float sx = x1 - gsv.x;
  float sy = y1 - gsv.y;

  // Interpolate on the x direction first
  float s0 = smoothmix(affin00, affin10, 1.0 - sx);
  float s1 = smoothmix(affin01, affin11, 1.0 - sx);
  float s2 = smoothmix(s0, s1, 1.0 - sy);

  // Used for textures that are absolute valued
  if (normal == 1.0) {
    return abs(s2) + 0.5;
  }

  return s2 * 0.5 + 0.5;
}

// Multiple layers of perlin noise weighted average
float turbulence(vec2 uv, float seed, float octaves) {
  float t = 0.0;
  for (float i = 1.0; i <= octaves; i++) {
    float factor = pow(2.0, i);
    t += perlin(seed, uv, factor, 1.0) * (1.0 / (factor));
  }
  return t;
}

// We need at least three textures
vec4 perlinStone(vec2 uv, float seed) {
  vec3 cols = vec3(169.0 / 256.0, 163.0 / 256.0, 163.0 / 256.0);
  float turb = turbulence(uv * 3.0, seed, 4.0);
  return vec4(cols * turb, 1.0);
}

// Logic for rendering magma would be blocks below a certain elevation
vec4 perlinMagma(vec2 uv, float seed) {
  // Colors for solid edges
  vec3 colsRock = vec3(92.0 / 256.0, 14.0 / 256.0, 14.0 / 256.0);
  vec3 colsLava = vec3(186.0, 72.0, 10.0) / 256.0;

  // Colors for lava
  float turb = turbulence(uv * 3.0, seed, 4.0);

  // Linear interpolation between colors
  if (turb < 0.6) {
    return vec4(colsLava, 1.0);
  }
  return vec4(colsRock * turb, 1.0);
}

vec4 perlinSnow(vec2 uv, float seed) {
  vec3 colsSnow = vec3(1.0, 1.0, 1.0);
  vec3 colsIce = vec3(185.0, 232.0, 234.0) / 256.0;
  vec3 colsHardIce = vec3(32.0, 195.0, 208.0) / 256.0;

  float turb = perlin(seed, uv, 12.0, 1.0);

  // Linear interpolation between colors
  if (turb < 0.75) {
    return vec4(colsSnow, 1.0);
  }
  if (turb > 0.95) {
    return vec4(colsHardIce, 1.0);
  }
  return vec4(colsIce, 1.0);
}

// Perlin noise generation
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // Generation seed
  float seed = 36.0;

  // Normalized pixel coordinates (from 0 to 1)
  vec2 uv = fragCoord / iResolution.xy;
  fragColor = perlinSnow(uv, seed);
}