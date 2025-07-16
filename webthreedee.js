class WebThreeDee {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.gl = this.canvas.getContext('webgl2');
        this.shapes = [];
        this.camera = new Camera();
        this.materialService = new MaterialService();
        
        if (!this.gl) {
            throw new Error('WebGL2 not supported');
        }
        
        this.init();
        this.setupEventListeners();
        this.render();
    }
    
    init() {
        this.resizeCanvas();
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.clearColor(0.1, 0.1, 0.1, 1.0);
        
        // Setup shaders
        this.setupShaders();
        
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    setupShaders() {
        const vertexShaderSource = `#version 300 es
            in vec3 a_position;
            in vec3 a_normal;
            
            uniform mat4 u_modelMatrix;
            uniform mat4 u_viewMatrix;
            uniform mat4 u_projectionMatrix;
            uniform mat4 u_normalMatrix;
            
            out vec3 v_normal;
            out vec3 v_position;
            
            void main() {
                vec4 worldPosition = u_modelMatrix * vec4(a_position, 1.0);
                v_position = worldPosition.xyz;
                v_normal = normalize((u_normalMatrix * vec4(a_normal, 0.0)).xyz);
                gl_Position = u_projectionMatrix * u_viewMatrix * worldPosition;
            }
        `;
        
        const fragmentShaderSource = `#version 300 es
            precision mediump float;
            
            in vec3 v_normal;
            in vec3 v_position;
            
            uniform vec3 u_color;
            uniform float u_shininess;
            uniform bool u_mirror;
            uniform vec3 u_lightPos;
            uniform vec3 u_viewPos;
            
            out vec4 fragColor;
            
            void main() {
                vec3 normal = normalize(v_normal);
                vec3 lightDir = normalize(u_lightPos - v_position);
                vec3 viewDir = normalize(u_viewPos - v_position);
                
                // Ambient
                vec3 ambient = 0.1 * u_color;
                
                // Diffuse
                float diff = max(dot(normal, lightDir), 0.0);
                vec3 diffuse = diff * u_color;
                
                // Specular
                vec3 reflectDir = reflect(-lightDir, normal);
                float spec = pow(max(dot(viewDir, reflectDir), 0.0), u_shininess * 128.0);
                vec3 specular = spec * vec3(1.0);
                
                vec3 result = ambient + diffuse + specular;
                
                if (u_mirror) {
                    result = mix(result, vec3(0.8, 0.9, 1.0), 0.3);
                }
                
                fragColor = vec4(result, 1.0);
            }
        `;
        
        this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
        this.gl.useProgram(this.program);
        
        // Get uniform locations
        this.uniforms = {
            modelMatrix: this.gl.getUniformLocation(this.program, 'u_modelMatrix'),
            viewMatrix: this.gl.getUniformLocation(this.program, 'u_viewMatrix'),
            projectionMatrix: this.gl.getUniformLocation(this.program, 'u_projectionMatrix'),
            normalMatrix: this.gl.getUniformLocation(this.program, 'u_normalMatrix'),
            color: this.gl.getUniformLocation(this.program, 'u_color'),
            shininess: this.gl.getUniformLocation(this.program, 'u_shininess'),
            mirror: this.gl.getUniformLocation(this.program, 'u_mirror'),
            lightPos: this.gl.getUniformLocation(this.program, 'u_lightPos'),
            viewPos: this.gl.getUniformLocation(this.program, 'u_viewPos')
        };
    }
    
    createProgram(vertexSource, fragmentSource) {
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource);
        
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            throw new Error('Program linking failed: ' + this.gl.getProgramInfoLog(program));
        }
        
        return program;
    }
    
    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            throw new Error('Shader compilation failed: ' + this.gl.getShaderInfoLog(shader));
        }
        
        return shader;
    }
    
    createShape(type, options = {}) {
        const shape = new Shape(type, options);
        this.shapes.push(shape);
        return shape;
    }
    
    setupEventListeners() {
        let mouseX = 0, mouseY = 0;
        let isMouseDown = false;
        
        this.canvas.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
        
        this.canvas.addEventListener('mouseup', () => {
            isMouseDown = false;
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (isMouseDown) {
                const deltaX = e.clientX - mouseX;
                const deltaY = e.clientY - mouseY;
                this.camera.rotate(deltaX * 0.005, deltaY * 0.005);
                mouseX = e.clientX;
                mouseY = e.clientY;
            }
        });
        
        this.canvas.addEventListener('wheel', (e) => {
            this.camera.zoom(e.deltaY * 0.001);
        });
        
        // WASD controls
        const keys = {};
        document.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
        document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
        
        const updateMovement = () => {
            if (keys['w']) this.camera.move(0, 0, 0.1);
            if (keys['s']) this.camera.move(0, 0, -0.1);
            if (keys['a']) this.camera.move(-0.1, 0, 0);
            if (keys['d']) this.camera.move(0.1, 0, 0);
            requestAnimationFrame(updateMovement);
        };
        updateMovement();
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.camera.aspect = this.canvas.width / this.canvas.height;
    }
    
    render() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        
        // Set camera uniforms
        this.gl.uniformMatrix4fv(this.uniforms.viewMatrix, false, this.camera.getViewMatrix());
        this.gl.uniformMatrix4fv(this.uniforms.projectionMatrix, false, this.camera.getProjectionMatrix());
        this.gl.uniform3fv(this.uniforms.lightPos, [10, 10, 10]);
        this.gl.uniform3fv(this.uniforms.viewPos, this.camera.position);
        
        // Render shapes
        this.shapes.forEach(shape => {
            shape.render(this.gl, this.uniforms);
        });
        
        requestAnimationFrame(() => this.render());
    }
}

// Vector class
class Vector {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    
    static create(x, y, z) {
        return new Vector(x, y, z);
    }
}

// Global vector function
function vector(x, y, z) {
    return new Vector(x, y, z);
}

// CFrame class
class CFrame {
    constructor(position = new Vector(), rotation = new Vector()) {
        this.position = position;
        this.rotation = rotation;
    }
    
    static create(position, rotation) {
        return new CFrame(position, rotation);
    }
    
    getMatrix() {
        const matrix = mat4.create();
        mat4.translate(matrix, matrix, [this.position.x, this.position.y, this.position.z]);
        mat4.rotateX(matrix, matrix, this.rotation.x * Math.PI / 180);
        mat4.rotateY(matrix, matrix, this.rotation.y * Math.PI / 180);
        mat4.rotateZ(matrix, matrix, this.rotation.z * Math.PI / 180);
        return matrix;
    }
}

// Material Service
class MaterialService {
    createMat(color, options = {}) {
        return new Material(color, options);
    }
    
    CreateMat(color, options = {}) {
        return this.createMat(color, options);
    }
}

// Material class
class Material {
    constructor(color, options = {}) {
        this.color = color;
        this.shininess = options.shininess || 0.5;
        this.mirror = options.mirror || false;
    }
}

// Shape class
class Shape {
    constructor(type, options = {}) {
        this.type = type;
        this.cframe = options.cframe || new CFrame();
        this.material = options.material || new Material([1, 1, 1]);
        this.geometry = this.createGeometry(type);
        this.setupBuffers();
    }
    
    createGeometry(type) {
        switch (type.toLowerCase()) {
            case 'cuboid':
            case 'cube':
                return this.createCuboid();
            case 'ellipsoid':
            case 'sphere':
                return this.createSphere();
            case 'cylinder':
                return this.createCylinder();
            case 'wedge':
                return this.createWedge();
            default:
                return this.createCuboid();
        }
    }
    
    createCuboid() {
        const vertices = [
            -1, -1,  1,   0,  0,  1,
             1, -1,  1,   0,  0,  1,
             1,  1,  1,   0,  0,  1,
            -1,  1,  1,   0,  0,  1,
            -1, -1, -1,   0,  0, -1,
            -1,  1, -1,   0,  0, -1,
             1,  1, -1,   0,  0, -1,
             1, -1, -1,   0,  0, -1,
            -1,  1, -1,   0,  1,  0,
            -1,  1,  1,   0,  1,  0,
             1,  1,  1,   0,  1,  0,
             1,  1, -1,   0,  1,  0,
            -1, -1, -1,   0, -1,  0,
             1, -1, -1,   0, -1,  0,
             1, -1,  1,   0, -1,  0,
            -1, -1,  1,   0, -1,  0,
             1, -1, -1,   1,  0,  0,
             1,  1, -1,   1,  0,  0,
             1,  1,  1,   1,  0,  0,
             1, -1,  1,   1,  0,  0,
            -1, -1, -1,  -1,  0,  0,
            -1, -1,  1,  -1,  0,  0,
            -1,  1,  1,  -1,  0,  0,
            -1,  1, -1,  -1,  0,  0,
        ];
        
        const indices = [
            0, 1, 2,   0, 2, 3,
            4, 5, 6,   4, 6, 7,
            8, 9, 10,  8, 10, 11,
            12, 13, 14, 12, 14, 15,
            16, 17, 18, 16, 18, 19,
            20, 21, 22, 20, 22, 23
        ];
        
        return { vertices, indices };
    }
    
    createSphere() {
        const vertices = [];
        const indices = [];
        const radius = 1;
        const latBands = 16;
        const lonBands = 16;
        
        for (let lat = 0; lat <= latBands; lat++) {
            const theta = lat * Math.PI / latBands;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);
            
            for (let lon = 0; lon <= lonBands; lon++) {
                const phi = lon * 2 * Math.PI / lonBands;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);
                
                const x = cosPhi * sinTheta;
                const y = cosTheta;
                const z = sinPhi * sinTheta;
                
                vertices.push(radius * x, radius * y, radius * z);
                vertices.push(x, y, z); // normal
            }
        }
        
        for (let lat = 0; lat < latBands; lat++) {
            for (let lon = 0; lon < lonBands; lon++) {
                const first = lat * (lonBands + 1) + lon;
                const second = first + lonBands + 1;
                
                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }
        
        return { vertices, indices };
    }
    
    createCylinder() {
        const vertices = [];
        const indices = [];
        const radius = 1;
        const height = 2;
        const segments = 16;
        
        // Center vertices for top and bottom caps
        vertices.push(0, height / 2, 0);   // Top center
        vertices.push(0, 1, 0);            // Normal up
        vertices.push(0, -height / 2, 0);  // Bottom center
        vertices.push(0, -1, 0);           // Normal down
        
        // Top and bottom circle vertices
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            // Top circle
            vertices.push(x, height / 2, z);
            vertices.push(0, 1, 0);
            
            // Bottom circle
            vertices.push(x, -height / 2, z);
            vertices.push(0, -1, 0);
        }
        
        // Side vertices
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            // Top side vertex
            vertices.push(x, height / 2, z);
            vertices.push(x, 0, z);
            
            // Bottom side vertex
            vertices.push(x, -height / 2, z);
            vertices.push(x, 0, z);
        }
        
        // Top cap indices
        for (let i = 0; i < segments; i++) {
            const topRing = 2 + i * 2;
            const nextTopRing = 2 + ((i + 1) % segments) * 2;
            indices.push(0, nextTopRing, topRing);
        }
        
        // Bottom cap indices
        for (let i = 0; i < segments; i++) {
            const bottomRing = 3 + i * 2;
            const nextBottomRing = 3 + ((i + 1) % segments) * 2;
            indices.push(1, bottomRing, nextBottomRing);
        }
        
        // Side faces indices
        const sideStart = 2 + (segments + 1) * 2;
        for (let i = 0; i < segments; i++) {
            const current = sideStart + i * 2;
            const next = sideStart + ((i + 1) % segments) * 2;
            
            indices.push(current, next, current + 1);
            indices.push(current + 1, next, next + 1);
        }
        
        return { vertices, indices };
    }
    
    createWedge() {
        const vertices = [
            -1, -1, 1,   0, 0, 1,
             1, -1, 1,   0, 0, 1,
             0,  1, 1,   0, 0, 1,
            -1, -1, -1,  0, 0, -1,
             0,  1, -1,  0, 0, -1,
             1, -1, -1,  0, 0, -1,
            -1, -1, -1,  0, -1, 0,
             1, -1, -1,  0, -1, 0,
             1, -1,  1,  0, -1, 0,
            -1, -1,  1,  0, -1, 0,
            -1, -1, -1,  -1, 0, 0,
            -1, -1,  1,  -1, 0, 0,
             0,  1,  1,  -1, 0, 0,
             0,  1, -1,  -1, 0, 0,
             1, -1, -1,  1, 0, 0,
             0,  1, -1,  1, 0, 0,
             0,  1,  1,  1, 0, 0,
             1, -1,  1,  1, 0, 0,
        ];
        
        const indices = [
            0, 1, 2,
            3, 4, 5,
            6, 7, 8,   6, 8, 9,
            10, 11, 12, 10, 12, 13,
            14, 15, 16, 14, 16, 17
        ];
        
        return { vertices, indices };
    }
    
    setupBuffers() {
        const gl = document.getElementById('canvas').getContext('webgl2');
        
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);
        
        // Position and normal buffer
        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.geometry.vertices), gl.STATIC_DRAW);
        
        // Position attribute
        const positionLoc = gl.getAttribLocation(gl.getParameter(gl.CURRENT_PROGRAM), 'a_position');
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 6 * 4, 0);
        
        // Normal attribute
        const normalLoc = gl.getAttribLocation(gl.getParameter(gl.CURRENT_PROGRAM), 'a_normal');
        gl.enableVertexAttribArray(normalLoc);
        gl.vertexAttribPointer(normalLoc, 3, gl.FLOAT, false, 6 * 4, 3 * 4);
        
        // Index buffer
        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.geometry.indices), gl.STATIC_DRAW);
        
        this.indexCount = this.geometry.indices.length;
    }
    
    render(gl, uniforms) {
        gl.bindVertexArray(this.vao);
        
        // Set model matrix
        const modelMatrix = this.cframe.getMatrix();
        gl.uniformMatrix4fv(uniforms.modelMatrix, false, modelMatrix);
        
        // Set normal matrix
        const normalMatrix = mat4.create();
        mat4.invert(normalMatrix, modelMatrix);
        mat4.transpose(normalMatrix, normalMatrix);
        gl.uniformMatrix4fv(uniforms.normalMatrix, false, normalMatrix);
        
        // Set material uniforms
        gl.uniform3fv(uniforms.color, this.material.color);
        gl.uniform1f(uniforms.shininess, this.material.shininess);
        gl.uniform1i(uniforms.mirror, this.material.mirror);
        
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    }
}

// Camera class
class Camera {
    constructor() {
        this.position = [0, 0, 5];
        this.rotation = [0, 0];
        this.fov = 45;
        this.aspect = 1;
        this.near = 0.1;
        this.far = 100;
    }
    
    move(x, y, z) {
        this.position[0] += x;
        this.position[1] += y;
        this.position[2] += z;
    }
    
    rotate(yaw, pitch) {
        this.rotation[0] += yaw;
        this.rotation[1] = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.rotation[1] + pitch));
    }
    
    zoom(delta) {
        this.position[2] += delta;
    }
    
    getViewMatrix() {
        const matrix = mat4.create();
        mat4.translate(matrix, matrix, this.position);
        mat4.rotateY(matrix, matrix, this.rotation[0]);
        mat4.rotateX(matrix, matrix, this.rotation[1]);
        mat4.invert(matrix, matrix);
        return matrix;
    }
    
    getProjectionMatrix() {
        const matrix = mat4.create();
        mat4.perspective(matrix, this.fov * Math.PI / 180, this.aspect, this.near, this.far);
        return matrix;
    }
}

// Simple mat4 implementation
const mat4 = {
    create() {
        return new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
    },
    
    translate(out, a, v) {
        out[12] = a[0] * v[0] + a[4] * v[1] + a[8] * v[2] + a[12];
        out[13] = a[1] * v[0] + a[5] * v[1] + a[9] * v[2] + a[13];
        out[14] = a[2] * v[0] + a[6] * v[1] + a[10] * v[2] + a[14];
        out[15] = a[3] * v[0] + a[7] * v[1] + a[11] * v[2] + a[15];
        return out;
    },
    
    rotateX(out, a, rad) {
        const s = Math.sin(rad);
        const c = Math.cos(rad);
        const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        
        out[4] = a10 * c + a20 * s;
        out[5] = a11 * c + a21 * s;
        out[6] = a12 * c + a22 * s;
        out[7] = a13 * c + a23 * s;
        out[8] = a20 * c - a10 * s;
        out[9] = a21 * c - a11 * s;
        out[10] = a22 * c - a12 * s;
        out[11] = a23 * c - a13 * s;
        return out;
    },
    
    rotateY(out, a, rad) {
        const s = Math.sin(rad);
        const c = Math.cos(rad);
        const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        
        out[0] = a00 * c - a20 * s;
        out[1] = a01 * c - a21 * s;
        out[2] = a02 * c - a22 * s;
        out[3] = a03 * c - a23 * s;
        out[8] = a00 * s + a20 * c;
        out[9] = a01 * s + a21 * c;
        out[10] = a02 * s + a22 * c;
        out[11] = a03 * s + a23 * c;
        return out;
    },
    
    rotateZ(out, a, rad) {
        const s = Math.sin(rad);
        const c = Math.cos(rad);
        const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        
        out[0] = a00 * c + a10 * s;
        out[1] = a01 * c + a11 * s;
        out[2] = a02 * c + a12 * s;
        out[3] = a03 * c + a13 * s;
        out[4] = a10 * c - a00 * s;
        out[5] = a11 * c - a01 * s;
        out[6] = a12 * c - a02 * s;
        out[7] = a13 * c - a03 * s;
        return out;
    },
    
    perspective(out, fovy, aspect, near, far) {
        const f = 1.0 / Math.tan(fovy / 2);
        const nf = 1 / (near - far);
        
        out[0] = f / aspect;
        out[1] = 0;
        out[2] = 0;
        out[3] = 0;
        out[4] = 0;
        out[5] = f;
        out[6] = 0;
        out[7] = 0;
        out[8] = 0;
        out[9] = 0;
        out[10] = (far + near) * nf;
        out[11] = -1;
        out[12] = 0;
        out[13] = 0;
        out[14] = (2 * far * near) * nf;
        out[15] = 0;
        return out;
    },
    
    invert(out, a) {
        const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
        
        const b00 = a00 * a11 - a01 * a10;
        const b01 = a00 * a12 - a02 * a10;
        const b02 = a00 * a13 - a03 * a10;
        const b03 = a01 * a12 - a02 * a11;
        const b04 = a01 * a13 - a03 * a11;
        const b05 = a02 * a13 - a03 * a12;
        const b06 = a20 * a31 - a21 * a30;
        const b07 = a20 * a32 - a22 * a30;
        const b08 = a20 * a33 - a23 * a30;
        const b09 = a21 * a32 - a22 * a31;
        const b10 = a21 * a33 - a23 * a31;
        const b11 = a22 * a33 - a23 * a32;
        
        let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
        
        if (!det) {
            return null;
        }
        det = 1.0 / det;
        
        out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
        out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
        out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
        out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
        out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
        out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
        out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
        out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
        out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
        out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
        out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
        out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
        out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
        out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
        out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
        out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
        
        return out;
    },
    
    transpose(out, a) {
        if (out === a) {
            const a01 = a[1], a02 = a[2], a03 = a[3];
            const a12 = a[6], a13 = a[7];
            const a23 = a[11];
            
            out[1] = a[4];
            out[2] = a[8];
            out[3] = a[12];
            out[4] = a01;
            out[6] = a[9];
            out[7] = a[13];
            out[8] = a02;
            out[9] = a12;
            out[11] = a[14];
            out[12] = a03;
            out[13] = a13;
            out[14] = a23;
        } else {
            out[0] = a[0];
            out[1] = a[4];
            out[2] = a[8];
            out[3] = a[12];
            out[4] = a[1];
            out[5] = a[5];
            out[6] = a[9];
            out[7] = a[13];
            out[8] = a[2];
            out[9] = a[6];
            out[10] = a[10];
            out[11] = a[14];
            out[12] = a[3];
            out[13] = a[7];
            out[14] = a[11];
            out[15] = a[15];
        }
        return out;
    }
};

// Global instance
let webthreedee;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    webthreedee = new WebThreeDee('canvas');
});
