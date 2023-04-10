float random (in vec2 pt, in float seed) {
    return fract(sin( (seed + dot(pt.xy, vec2(12.9898,78.233))))*43758.5453123);
}

vec2 unit_vec(in vec2 xy, in float seed) {
    float theta = 6.28318530718*random(xy, seed);
    return vec2(cos(theta), sin(theta));
}

vec2 time_unit_vec(in vec2 xy, in float seed) {
    float theta = 6.28318530718*random(xy, seed) + 0.0;
    return vec2(cos(theta), sin(theta));
}

float smoothmix(float a0, float a1, float w) {
    return (a1 - a0) * (3.0 - w * 2.0) * w * w + a0;
}

float perlin(float seed, vec2 uv, float gridSpace, bool timeVarying) {
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
    vec2 vecuv00 = timeVarying ? time_unit_vec(uv00, seed) : unit_vec(uv00, seed);
    vec2 vecuv10 = timeVarying ? time_unit_vec(uv10, seed) : unit_vec(uv10, seed);
    vec2 vecuv01 = timeVarying ? time_unit_vec(uv01, seed) : unit_vec(uv01, seed);
    vec2 vecuv11 = timeVarying ? time_unit_vec(uv11, seed) : unit_vec(uv11, seed);

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

    // Normalize to [0, 1]
    return (s2 * 0.5) + 0.5;
}

void main() {
    vec3 kd = vec3(1.0, 1.0, 1.0);
    vec3 ka = vec3(0.1, 0.1, 0.1);

    float seed = 1.0;
    float perlinValue = 0.5 * perlin(seed, uv, 4.0, true) + 0.25 * perlin(seed, uv, 8.0, true) +
            0.125 * perlin(seed, uv, 16.0, true) + 0.0625 * perlin(seed, uv, 32.0, true);
    vec3 perlinColor = vec3(perlinValue);
    kd += perlinColor;

    gl_FragColor = vec4(perlinColor, 1.0);
}
