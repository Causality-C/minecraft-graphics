export const blankCubeVSText = `
    precision mediump float;

    uniform vec4 uLightPos;
    uniform mat4 uView;
    uniform mat4 uProj;

    attribute vec4 aNorm;
    attribute vec4 aVertPos;
    attribute vec4 aOffset;
    attribute vec2 aUV;

    varying vec4 normal;
    varying vec4 wsPos;
    varying vec2 uv;
    varying float highlight;

    void main () {
        vec4 offset = vec4(aOffset.x, aOffset.y, aOffset.z, 0.0);
        highlight = aOffset.w;
        gl_Position = uProj * uView * (aVertPos + offset);
        wsPos = aVertPos + aOffset;
        normal = normalize(aNorm);
        uv = aUV;
    }
`;

export const blankCubeFSText = `
    precision mediump float;

    uniform vec4 uLightPos;
    uniform float uTime;

    varying vec4 normal;
    varying vec4 wsPos;
    varying vec2 uv;
    varying float highlight;

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

    vec2 time_unit_vec(in vec2 xy, in float seed) {
        float theta = 6.28318530718*random(xy, seed) + uTime;
        return vec2(cos(theta), sin(theta));
    }

    float perlin(float seed, vec2 uv, float gridSpace, float normal, float time) {
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
        if(time == 1.0) {
            vecuv00 = time_unit_vec(uv00, seed);
            vecuv10 = time_unit_vec(uv10, seed);
            vecuv01 = time_unit_vec(uv01, seed);
            vecuv11 = time_unit_vec(uv11, seed);
        }

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
        if (normal == 1.0) {
            return abs(s2) + 0.5;
        }
        return s2 * 0.5 + 0.5;
    }
    // Multiple layers of perlin noise weighted average
    #define OCTAVES 4.0
    float turbulence(vec2 uv, float seed, float time) {
        float t = 0.0;
        for (float i = 1.0; i <= OCTAVES; i++) {
            float factor = pow(2.0, i);
            t += perlin(seed, uv, factor, 1.0, time) * (1.0 / (factor));
        }
        return t;
    }

    // We need at least three textures
    vec3 perlinStone(vec2 uv, float seed) {
        vec3 cols = vec3(169.0 / 256.0, 163.0 / 256.0, 163.0 / 256.0);
        float turb = turbulence(uv * 3.0, seed, 0.0);
        return cols * turb;
    }

    // Logic for rendering portal blocks
    vec3 perlinPortal(vec2 uv, float seed) {
        // Colors for solid edges
        vec3 colsPurple = vec3(86.0 / 256.0, 60.0 / 256.0, 92.0 / 256.0);
        vec3 colsBlack = vec3(5.0, 5.0, 5.0) / 256.0;
        vec3 colsDarkPurple = vec3(45.0,18.0,51.0) / 256.0;

        // Colors for lava
        float turb = turbulence(uv * 3.0, seed, 1.0);

        // Linear interpolation between colors
        if (turb < 0.75) {
            return colsDarkPurple;
        }
        if (turb > 0.95) {
            return colsBlack;
        }
        return colsPurple;
    }

    // Logic for rendering magma would be blocks below a certain elevation
    vec3 perlinMagma(vec2 uv, float seed) {
        // Colors for solid edges
        vec3 colsRock = vec3(92.0 / 256.0, 14.0 / 256.0, 14.0 / 256.0);
        vec3 colsLava = vec3(186.0, 72.0, 10.0) / 256.0;
        vec3 colsBright = vec3(234.0,169.0,46.0) / 256.0;

        // Colors for lava
        float turb = turbulence(uv * 3.0, seed, 1.0);

        // Linear interpolation between colors
        if (turb < 0.6) {
            // Should be between 0.0 and 1.0
            float weight = cos(uTime) + 1.0;
            return colsLava + (colsBright - colsLava) * weight * 0.5;
        }
        return colsRock * turb;
    }

    vec3 perlinSnow(vec2 uv, float seed) {
        vec3 colsSnow = vec3(1.0, 1.0, 1.0);
        vec3 colsIce = vec3(185.0, 232.0, 234.0) / 256.0;
        vec3 colsHardIce = vec3(32.0, 195.0, 208.0) / 256.0;

        float turb = perlin(seed, uv, 12.0, 1.0, 0.0);

        // Linear interpolation between colors
        if (turb < 0.75) {
            return colsSnow;
        }
        if (turb > 0.95) {
            return colsHardIce;
        }
        return colsIce;
    }


    void main() {
        // Can change based on texture in the future
        float seed = 10.0;
        vec3 kd = vec3(1.0, 1.0, 1.0);
        vec3 ka = vec3(0.3, 0.3, 0.3);
        float epsilon = 0.1;

        /* Compute light fall off */
        vec4 lightDirection = uLightPos - wsPos;
        float dot_nl = dot(normalize(lightDirection), normalize(normal));
	    dot_nl = clamp(dot_nl, 0.0, 1.0);

        // Highlight logic for the block

        
        if (highlight >= 2.0 - epsilon) {
            if (highlight >= 2.0 - epsilon && highlight <= 2.0 + epsilon) { 
                // Green means add
                gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
            } 
            else if(highlight >= 4.0 - epsilon) {
                // purple means add a portal block
                vec3 portal = perlinPortal(uv, seed);
                gl_FragColor = vec4(clamp(ka + dot_nl * kd, 0.0, 1.0)* portal, 1.0);
            }
            else {
                // Red means delete
                gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
            }
        } 
        else {
            // Lava/Magma only generates on low locations
            if(wsPos.y < 20.5) {
                vec3 magma = perlinMagma(uv, seed);
                gl_FragColor = vec4(clamp(ka + dot_nl * kd, 0.0, 1.0)* magma, 1.0);
            }
            // Snow only generates on high locations
            else if(wsPos.y > 55.0){
                vec3 snow = perlinSnow(uv, seed);
                gl_FragColor = vec4(clamp(ka + dot_nl * kd, 0.0, 1.0)* snow, 1.0);
            }
            // Stone
            else{
                vec3 stone = perlinStone(uv, seed);
                gl_FragColor = vec4(clamp(ka + dot_nl * kd, 0.0, 1.0)* stone, 1.0);
            }
        }
        
        // if(highlight == 5.0) {
        //     // blue means add a portal block
        //     gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);
        // }
    }
`;

export let portalMeshVSText = `
    precision mediump float;

    uniform vec4 uLightPos;
    uniform mat4 uView;
    uniform mat4 uProj;

    attribute vec4 aNorm;
    attribute vec4 aVertPos;
    attribute vec2 aUV;

    varying vec4 normal;
    varying vec2 uv;

    varying highp float directional;

    void main () {
		//  Convert vertex to camera coordinates and the NDC
        gl_Position = uProj * uView * aVertPos;
        normal = normalize(aNorm);
        uv = aUV;

        // For some reason, some perspectives are flipped horizontally
        // if(normal.x == 1.0 || normal.z == -1.0){
        //     uv = vec2(aUV.x, aUV.y);
        // }
        // else{
        //     uv = vec2(1.0 - aUV.x, aUV.y);
        // }
    }
`;

export let portalMeshFSText = `
    precision mediump float;

    varying vec4 normal;
    varying vec2 uv;  
    uniform sampler2D uTexture;
	
    varying highp float directional;
    void main () {
        gl_FragColor = texture2D(uTexture, uv);
    }
`;
