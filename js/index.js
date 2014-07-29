var GP = GP || {};


(function () {

    'use strict';


    if (!Detector.webgl) Detector.addGetWebGLMessage();

    GP.Universe = function (container, config) {

        config = config || {};
        this.config.antialias = config.antialias || false;

        this.container = container;

        this.wallSize = new THREE.Vector2(container.clientWidth, container.clientHeight);

        this.booms = [];

        var init = function (container) {

            var scene, camera, cameraAnchor, renderer;

            var lights, wall, balls;

            // scene

            scene = new THREE.Scene();
            //scene.fog = new THREE.Fog(0xeeeeee, 1000, 3000);


            // camera

            // camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 500);
            // camera.position.set(0, 0, 100);
            // camera.name = "p";

            camera = new THREE.OrthographicCamera(-container.clientWidth / 2, container.clientWidth / 2, container.clientHeight / 2, -container.clientHeight / 2, -100, 100);
            camera.name = "o";

            cameraAnchor = new THREE.Object3D();
            cameraAnchor.add(camera);

            scene.add(cameraAnchor);


            // lights

            lights = [];

            {
                var l;

                l = new THREE.AmbientLight(0xBBBBBB);
                lights.push(l);
                scene.add(l);

                l = new THREE.HemisphereLight(0x777777, 0, 0.1);
                l.position.set(0, 0, 500);
                lights.push(l);
                scene.add(l);

                l = new THREE.PointLight(0xEEEEEE, 0.8, this.wallSize.x * 3);
                l.position.set(this.wallSize.x, this.wallSize.y, 0);
                lights.push(l);
                scene.add(l);

            }


            // wall
            {
                wall = {

                    size: this.wallSize,
                    scene: this.scene,
                    booms: this.booms,

                    canvas: null,
                    context: null,
                    mesh: null,

                    update: function (time) {

                        if (this.canvas === null) {
                            this.canvas = document.createElement('canvas');
                        }

                        // http://graphics.stanford.edu/~seander/bithacks.html#RoundUpPowerOf2
                        var w = this.size.x;
                        w--;
                        w |= w >> 1;
                        w |= w >> 2;
                        w |= w >> 4;
                        w |= w >> 8;
                        w |= w >> 16;
                        w++;

                        var h = w / (this.size.x / this.size.y);
                        h--;
                        h |= h >> 1;
                        h |= h >> 2;
                        h |= h >> 4;
                        h |= h >> 8;
                        h |= h >> 16;
                        h++;

                        this.canvas.width = w;
                        this.canvas.height = h;

                        var ctx = this.context;

                        if (ctx === null) {
                            ctx = this.canvas.getContext('2d');
                        }

                        ctx.globalAlpha = 0.4;
                        ctx.fillStyle = "#ffffff";

                        ctx.beginPath();
                        var b, bToDelete = [];
                        for (var i = 0; i < this.booms.length; i++) {

                            b = this.booms[i];
                            b.update(time);
                            if (b.isDead) {
                                bToDelete.push(i);
                            } else {
                                ctx.arc(15 + 25 * i, 15, b.radius, 0, 2 * Math.PI);
                            }
                        }
                        ctx.fill();

                        // clean booms
                        for (var i = 0; i < bToDelete.length; i++) {
                            this.deleteBoom(i);
                        }

                        if (this.mesh === null) {

                            var g = new THREE.PlaneGeometry(this.size.x, this.size.y);

                            var m = new THREE.MeshBasicMaterial({
                                map: new THREE.Texture(this.canvas),
                                transparent: true
                            });

                            this.mesh = new THREE.Mesh(g, m);

                            scene.add(this.mesh);

                        }

                        this.mesh.material.map.needsUpdate = true;
                    },

                    deleteBoom: function (i) {

                        if (this.booms.length < 1) {

                            this.booms = [];

                        } else {

                            this.booms.splice(i, 1);

                        }
                    }

                };

                wall.update();

            }

            // balls

            balls = [];

            window.setTimeout(this.initBalls.bind(this), 1);

            // renderer

            renderer = (function initRenderer(scene) {

                var renderer = new THREE.WebGLRenderer({
                    antialias: config.antialias,
                    alpha: true
                });

                // renderer.setClearColor(scene.fog.color, 1);

                renderer.setSize(container.clientWidth, container.clientHeight);

                return renderer;

            })(scene);



            this.scene = scene;
            this.camera = camera;
            this.cameraAnchor = cameraAnchor;
            this.lights = lights;
            this.wall = wall;
            this.balls = balls;
            this.renderer = renderer;

            container.appendChild(this.canvas = renderer.domElement);

            this.onCanvasResize(this.canvas.clientWidth, this.canvas.clientHeight);

        };


        this.initBalls = function () {

            var wallSizeHalf = new THREE.Vector2(this.wallSize.x / 2, this.wallSize.y / 2),
                radiusMin = Math.min(this.wallSize.x, this.wallSize.y) * 0.05,
                radiusMax = Math.min(this.wallSize.x, this.wallSize.y) * 0.20,
                posMax = wallSizeHalf,
                segW = 30,
                segH = ~~ (segW * 0.7);

            var r = function (max) {
                    return (~~(Math.random() * max));
                },
                c = [0x0099CC, 0xAA66CC, 0x99CC00, 0xFFBB33, 0xFF4444], // colors
                cl = c.length - 1,
                cli = 0, // color cursor
                g, // temp geometry
                m, // temp material
                ball, // temp mesh
                radius, // temp radius
                pos; // temp pos

            var newPos = function (radius) {

                var pos = new THREE.Vector2(),
                    tries = 5;

                // avoid too many overlapping balls
                var validatePosition = function (radius, pos) {

                    var other,
                        d,
                        a, b;

                    for (var i = 0; i < this.balls.length; i++) {
                        other = this.balls[i];
                        if (other != undefined) {
                            a = Math.pow(other.position.x - pos.x, 2);
                            b = Math.pow(other.position.y - pos.y, 2);
                            d = Math.sqrt(a + b);

                            if (d < (other.radius + radius) * 0.75) return false;
                        }
                    }

                    //                     console.log(~~d, other ? ~~other.radius : null, ~~radius);

                    return true;

                }.bind(this);

                do {
                    pos = new THREE.Vector2(
                        r(posMax.x) - posMax.x / 2,
                        r(posMax.y) - posMax.y / 2
                    );
                }
                while (!validatePosition(radius, pos) && tries-- > 0)

                return tries > 0 ? pos : null;

            }.bind(this);

            for (var i = 0; i < 30; i++) {

                radius = r(radiusMax - radiusMin) + radiusMin;
                pos = newPos(radius);

                if (pos !== null) {

                    g = new THREE.SphereGeometry(radius, segW, segH, 0, Math.PI);
                    g.radius = radius;

                    var color = c[++cli % (cl + 1)];

                    m = new THREE.MeshPhongMaterial({
                        ambient: color,
                        color: color,
                        // shading: THREE.FlatShading,
                        // specular: 0xbbbbbb,
                        shininess: 60,
                        metal: true
                    });

                    ball = new THREE.Mesh(g, m);
                    ball.radius = radius;
                    // ball.rotateX(0.5 * Math.PI);
                    ball.position.set(pos.x, pos.y, 0);

                    ball.name = "ball" + i + "#" + m.color.getHexString() + "@" + JSON.stringify(ball.position);

                    this.balls.push(ball);
                    this.scene.add(ball);

                    //                         console.log("new: ball(%i, %i, %i) @%i:%i", radius, segW, segH, pos.x, pos.y);
                }
            }

            console.log(this.balls.length + " balls created.");

            this.initEvents();

        };

        this.initEvents = function () {

            this.picker = {
                camera: this.camera,
                wall: this.wall,
                boom: this.boom.bind(this),

                width: this.container.clientWidth,
                height: this.container.clientHeight,
                widthHalf: this.container.clientWidth / 2,
                heightHalf: this.container.clientHeight / 2,

                targets: this.balls,

                projector: new THREE.Projector(),
                vector: new THREE.Vector3(),

                pickAt: function (x, y) {

                    this.vector.set((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1, 0);

                    var ray;

                    if (this.camera.name == "o") {

                        ray = this.projector.pickingRay(this.vector, this.camera);

                    } else {

                        this.projector.unprojectVector(this.vector, this.camera);

                        ray = new THREE.Raycaster(this.camera.position, this.vector.sub(this.camera.position).normalize());

                    }

                    var intersects = ray.intersectObjects(this.targets);

                    if (intersects.length > 0) {

                        this.boom(intersects[0].object);

                    }
                },
            };

            // http://mwbrooks.github.io/thumbs.js/
            this.container.addEventListener('touchstart', this.onClick.bind(this), false);

        };

        this.onClick = function (e) {

            this.picker.pickAt(e.clientX, e.clientY);

        };

        this.onCanvasResize = function (w, h) {

            this.canvas.width = w;
            this.canvas.height = h;

            if (this.camera.name == "o") {

                this.camera.left = -container.clientWidth / 2;
                this.camera.right = container.clientWidth / 2;
                this.camera.top = container.clientHeight / 2;
                this.camera.bottom = -container.clientHeight / 2;

            } else {

                this.camera.aspect = w / h;
            }

            this.camera.updateProjectionMatrix();

            this.renderer.setSize(w, h);
        }.bind(this);

        this.boom = function (ball) {

            console.log("Boom ", ball.name);

            this.booms.push(new GP.Boom(ball));

            this.wall.update();

        };



        this.startDate = Date.now();

        this.animate = function (time, delta) {

            if (this.booms.length > 0) {
                this.wall.update(time);
            }

        };


        var lastTime = 0;

        this.render = (function () {

            var time = Date.now() - this.startDate,
                w = this.canvas.clientWidth,
                h = this.canvas.clientHeight;

            if (this.canvas.width != w || this.canvas.height != h) {
                this.onCanvasResize(w, h);
            }

            this.renderer.render(this.scene, this.camera);

            this.animate(time, time - lastTime);

            lastTime = time;

            requestAnimationFrame(this.render);

        }).bind(this);


        init.call(this, container);

        return this;
    };

    GP.Universe.prototype = {

        constructor: GP.Universe,

        config: {},

        container: null,
        canvas: null,

        camera: null,
        cameraAnchor: null,

        scene: null,
        renderer: null,

        floor: null,
        lights: null,
        wall: null,
        booms: null,

        startDate: null,
        render: null
    };


    GP.Boom = function (ball) {

        if (!ball) throw new Error("A Boom needs a ball!");

        this.ball = ball;
        this.startDate = Date.now();
        this.endDate = Date.now() + 1000 * 4;

        this.radius = ball.geometry.radius;
        this.opacity = 1;
    };

    GP.Boom.prototype = {

        ball: null, // mesh object source
        startDate: null, // date source
        endDate: null, // date death

        radius: null, // current radius of the orb
        opacity: null,

        isDead: false,

        constructor: GP.Boom,

        update: function update(time) {

            this.radius++;

            if (Date.now() > this.endDate) {
                this.isDead = true;
            }
        }
    };


})();

var uni = new GP.Universe(document.getElementById('container'));
uni.render();