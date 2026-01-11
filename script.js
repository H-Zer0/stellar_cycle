/**
 * Stellar Cycle
 * Abstract space simulation with p5.js
 */

let universe;
let currentState = "INIT";
let targetPos = null;
let screens = {};

const STATES = {
    INIT: "INIT",
    SELECT_POSITION: "SELECT_POSITION",
    SET_PARAMETERS: "SET_PARAMETERS",
    BIG_BANG: "BIG_BANG",
    STAR_FORMATION: "STAR_FORMATION",
    OBSERVATION: "OBSERVATION",
    BLACK_HOLE_SINK: "BLACK_HOLE_SINK",
    END: "END"
};

class Particle {
    constructor(x, y, isExplosion = false, mass = 50, col = [255, 255, 255]) {
        this.pos = createVector(x, y);
        if (isExplosion) {
            let angle = random(TWO_PI);
            let speed = random(2, map(mass, 0, 100, 6, 20));
            this.vel = createVector(cos(angle) * speed, sin(angle) * speed);
        } else {
            this.vel = createVector(random(-1, 1), random(-1, 1));
        }
        this.acc = createVector(0, 0);
        this.size = random(1, 4);
        this.alpha = random(180, 255);
        this.baseX = x;
        this.baseY = y;
        this.isExplosion = isExplosion;
        this.col = col;
        this.friction = 0.97;
    }

    applyForce(force) {
        this.acc.add(force);
    }

    update() {
        if (currentState === STATES.STAR_FORMATION) {
            let target = createVector(universe.targetStar.pos.x, universe.targetStar.pos.y);
            let dir = p5.Vector.sub(target, this.pos);
            let dist = dir.mag();
            if (dist < 8) {
                this.alpha -= 10;
            } else {
                dir.normalize();
                dir.mult(0.25);
                this.applyForce(dir);
                this.vel.add(this.acc);
                this.vel.limit(5);
                this.pos.add(this.vel);
                this.acc.mult(0);
            }
        } else if (this.isExplosion) {
            this.vel.mult(this.friction);
            this.pos.add(this.vel);
            this.alpha -= 2;
        } else if (currentState === STATES.BLACK_HOLE_SINK) {
            let target = createVector(universe.targetStar.pos.x, universe.targetStar.pos.y);
            let dir = p5.Vector.sub(target, this.pos);
            dir.normalize();
            dir.mult(2.0); // Fast pull
            this.pos.add(dir);
            this.alpha -= 3;
        } else {
            this.pos.x = this.baseX + sin(frameCount * 0.01 + this.alpha) * 5;
            this.pos.y = this.baseY + cos(frameCount * 0.01 + this.alpha) * 5;
        }
    }

    draw() {
        if (this.alpha <= 0) return;
        noStroke();
        fill(this.col[0], this.col[1], this.col[2], this.alpha);
        circle(this.pos.x, this.pos.y, this.size);
    }
}

class Star {
    constructor(x, y, mass, instability) {
        this.pos = createVector(x, y);
        this.mass = parseFloat(mass);
        this.instability = parseFloat(instability);
        this.size = 0;
        this.targetSize = map(this.mass, 0, 100, 20, 70);
        this.currentAlpha = 0;
        this.maxAlpha = 255;
        this.life = map(this.mass, 0, 100, 600, 1500);
        this.exploded = false;

        // 色の計算 (大質量:鋭い青白, 小質量:深い赤)
        let c1 = color(255, 30, 0); // 激しい赤
        let c2 = color(255, 200, 150); // オレンジ・ゴールド
        let c3 = color(255, 255, 255); // 白
        let c4 = color(0, 150, 255); // 鋭い青

        let c;
        if (this.mass < 33) {
            c = lerpColor(c1, c2, map(this.mass, 0, 33, 0, 1));
        } else if (this.mass < 66) {
            c = lerpColor(c2, c3, map(this.mass, 33, 66, 0, 1));
        } else {
            c = lerpColor(c3, c4, map(this.mass, 66, 100, 0, 1));
        }

        // 先代の色の影響を強めに受けるように修正
        if (universe.legacyColor) {
            let lc = color(universe.legacyColor[0], universe.legacyColor[1], universe.legacyColor[2]);
            c = lerpColor(c, lc, 0.25);
        }

        this.col = [red(c), green(c), blue(c)];
    }

    update() {
        if (currentState === STATES.STAR_FORMATION) {
            if (this.size < this.targetSize) this.size += 0.2;
            if (this.currentAlpha < this.maxAlpha) this.currentAlpha += 5;
        } else if (currentState === STATES.OBSERVATION) {
            this.life -= 1;
            if (this.life <= 0) changeState(STATES.END);
        }
    }

    draw() {
        if (this.size <= 0) return;

        // 脈動ロジック (不規則性を強調)
        let pulseSpeed = map(this.instability, 0, 100, 0.03, 0.2);
        let pulseAmp = map(this.instability, 0, 100, 1, 20);
        let time = frameCount * pulseSpeed;
        if (this.instability > 50) {
            time += noise(frameCount * 0.1) * map(this.instability, 50, 100, 0, 10);
        }
        let pulse = sin(time) * pulseAmp;
        let currentSize = this.size + pulse;

        // 終焉ロジック
        if (currentState === STATES.END && !this.exploded) {
            if (this.mass > 90) {
                changeState(STATES.BLACK_HOLE_SINK);
                this.exploded = true;
                universe.addNebula(this.pos.x, this.pos.y, this.col, true);
            } else if (this.mass > 50) {
                universe.explode(this.pos.x, this.pos.y, this.mass, this.col, "SUPERNOVA");
                this.exploded = true;
                this.size = 0;
                universe.addNebula(this.pos.x, this.pos.y, this.col);
            } else {
                this.size -= 0.3;
                this.currentAlpha -= 5;
                if (frameCount % 3 === 0) {
                    universe.explosionParticles.push(new Particle(this.pos.x + random(-15, 15), this.pos.y + random(-15, 15), true, 10, this.col));
                }
                if (this.size <= 0) {
                    this.size = 0;
                    this.exploded = true;
                    universe.addNebula(this.pos.x, this.pos.y, this.col);
                }
            }
        }

        if (this.size > 0 && currentState !== STATES.BLACK_HOLE_SINK) {
            push();
            translate(this.pos.x, this.pos.y);

            // 外側の重厚なグロー
            for (let i = 6; i > 0; i--) {
                fill(this.col[0], this.col[1], this.col[2], (this.currentAlpha / 15) / i);
                let gSize = (currentSize + (i * 25)) * (1 + (this.mass > 60 ? sin(frameCount * 0.1) * 0.08 : 0));
                circle(0, 0, gSize);
            }

            // 本体の描画 (歪みを極端に)
            fill(this.col[0], this.col[1], this.col[2], this.currentAlpha);
            if (this.instability > 40) {
                beginShape();
                for (let a = 0; a < TWO_PI; a += 0.1) {
                    let noiseVal = noise(cos(a) + 1, sin(a) + 1, frameCount * 0.05);
                    let offset = noiseVal * map(this.instability, 40, 100, 0, 30);
                    let r = currentSize / 2 + offset;
                    let x = cos(a) * r;
                    let y = sin(a) * r;
                    vertex(x, y);
                }
                endShape(CLOSE);
            } else {
                circle(0, 0, currentSize);
            }

            // 大質量星のハレーションをより鮮明に
            if (this.mass > 75) {
                stroke(this.col[0], this.col[1], this.col[2], 80);
                strokeWeight(2);
                let hLen = currentSize * 2.5;
                line(-hLen, 0, hLen, 0);
                line(0, -hLen, 0, hLen);
                if (this.mass > 90) {
                    rotate(PI / 4);
                    line(-hLen * 0.7, 0, hLen * 0.7, 0);
                    line(0, -hLen * 0.7, 0, hLen * 0.7);
                }
            }
            pop();
        } else if (currentState === STATES.BLACK_HOLE_SINK) {
            // ブラックホールのイベントホライゾン
            fill(0);
            stroke(this.col[0], this.col[1], this.col[2], 200);
            strokeWeight(3);
            circle(this.pos.x, this.pos.y, currentSize * 0.6);

            // アクリーションディスクのような光
            noStroke();
            for (let i = 3; i > 0; i--) {
                fill(this.col[0], this.col[1], this.col[2], 30 / i);
                circle(this.pos.x, this.pos.y, currentSize * (1.2 + i * 0.5));
            }
        }
    }
}

class Universe {
    constructor() {
        this.noiseOffset = 0;
        this.bgStars = [];
        this.dustParticles = [];
        this.explosionParticles = [];
        this.nebulae = [];
        this.targetStar = null;
        this.shakeAmount = 0;
        this.legacyBrightness = 15;
        this.legacyColor = null;
        this.initBackgroundStars();
    }

    initBackgroundStars() {
        this.bgStars = [];
        for (let i = 0; i < 250; i++) {
            this.bgStars.push({
                x: random(width),
                y: random(height),
                size: random(0.5, 2.0),
                alpha: random(50, 180)
            });
        }
    }

    initDustParticles() {
        this.dustParticles = [];
        for (let i = 0; i < 500; i++) {
            let angle = random(TWO_PI);
            let r = random(width * 0.2, max(width, height));
            let x = this.targetStar.pos.x + cos(angle) * r;
            let y = this.targetStar.pos.y + sin(angle) * r;
            this.dustParticles.push(new Particle(x, y, false, 50, this.targetStar.col));
        }
    }

    addNebula(x, y, color, isBlackHole = false) {
        let count = isBlackHole ? 100 : 70;
        for (let i = 0; i < count; i++) {
            this.nebulae.push({
                x: x + random(-60, 60),
                y: y + random(-60, 60),
                size: random(5, 15),
                alpha: random(10, 40),
                col: color,
                driftX: random(-0.1, 0.1),
                driftY: random(-0.1, 0.1)
            });
        }
        this.legacyBrightness = min(this.legacyBrightness + 10, 60);
        this.legacyColor = color;
    }

    explode(x, y, mass, color, mode = "SUPERNOVA") {
        this.shake(mode === "BLACK_HOLE" ? 50 : 35);
        this.explosionParticles = [];
        let count = map(mass, 0, 100, 300, 800);

        for (let i = 0; i < count; i++) {
            let pColor = color;
            if (mode === "SUPERNOVA") {
                // 金、碧、白を混ぜて煌びやかに
                let r = random();
                if (r > 0.8) pColor = [255, 215, 0]; // Gold
                else if (r > 0.6) pColor = [100, 255, 200]; // Emerald
                else if (r > 0.4) pColor = [255, 255, 255]; // White
            }
            this.explosionParticles.push(new Particle(x, y, true, mass, pColor));
        }
    }

    shake(amount) {
        this.shakeAmount = amount;
    }

    draw() {
        push();
        if (this.shakeAmount > 0) {
            translate(random(-this.shakeAmount, this.shakeAmount), random(-this.shakeAmount, this.shakeAmount));
            this.shakeAmount *= 0.94;
            if (this.shakeAmount < 0.1) this.shakeAmount = 0;
        }

        background(5, 5, 8); // かすかに青みがかった黒

        // 永続的な星間塵の描画
        for (let n of this.nebulae) {
            n.x += n.driftX;
            n.y += n.driftY;
            noStroke();
            fill(n.col[0], n.col[1], n.col[2], n.alpha);
            circle(n.x, n.y, n.size);
        }

        noStroke();
        let resolution = 120;
        for (let x = 0; x < width + resolution; x += resolution) {
            for (let y = 0; y < height + resolution; y += resolution) {
                let n = noise(x * 0.003, y * 0.003, this.noiseOffset);
                let col = [255, 255, 255];
                if (this.legacyColor) {
                    col = [
                        lerp(255, this.legacyColor[0], 0.3),
                        lerp(255, this.legacyColor[1], 0.3),
                        lerp(255, this.legacyColor[2], 0.3)
                    ];
                }
                fill(col[0], col[1], col[2], n * this.legacyBrightness);
                rect(x, y, resolution, resolution);
            }
        }
        this.noiseOffset += 0.0015;

        for (let s of this.bgStars) {
            fill(255, 255, 255, s.alpha * (0.5 + 0.5 * sin(frameCount * 0.01 + s.x)));
            circle(s.x, s.y, s.size);
        }

        for (let i = this.dustParticles.length - 1; i >= 0; i--) {
            let p = this.dustParticles[i];
            p.update();
            p.draw();
            if (p.alpha <= 0) this.dustParticles.splice(i, 1);
        }

        for (let i = this.explosionParticles.length - 1; i >= 0; i--) {
            let p = this.explosionParticles[i];
            p.update();
            p.draw();
            if (p.alpha <= 0) this.explosionParticles.splice(i, 1);
        }

        if (this.targetStar) {
            this.targetStar.update();
            this.targetStar.draw();
        }

        pop();

        if (currentState === STATES.BIG_BANG) {
            let flashAlpha = map(this.bigBangTimer, 0, 60, 255, 0);
            fill(255, 255, 255, flashAlpha);
            rect(0, 0, width, height);
            this.bigBangTimer -= 1;
            if (this.bigBangTimer <= 0) {
                changeState(STATES.STAR_FORMATION);
            }
        }

        if (currentState === STATES.BLACK_HOLE_SINK) {
            fill(0, 0, 0, this.sinkAlpha || 0);
            rect(0, 0, width, height);
            this.sinkAlpha = (this.sinkAlpha || 0) + 4;
            if (this.sinkAlpha >= 255) {
                changeState(STATES.END);
            }
        }
    }
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    universe = new Universe();

    screens[STATES.INIT] = document.getElementById('state-init');
    screens[STATES.SELECT_POSITION] = document.getElementById('state-select');
    screens[STATES.SET_PARAMETERS] = document.getElementById('state-params');
    screens[STATES.OBSERVATION] = document.getElementById('state-observation');
    screens[STATES.END] = document.getElementById('state-end');

    document.getElementById('btn-start').addEventListener('click', () => {
        changeState(STATES.SELECT_POSITION);
    });

    document.getElementById('btn-observe').addEventListener('click', () => {
        let mass = document.getElementById('slider-mass').value;
        let instability = document.getElementById('slider-instability').value;
        universe.targetStar = new Star(targetPos.x, targetPos.y, mass, instability);
        changeState(STATES.BIG_BANG);
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
        targetPos = null;
        universe.targetStar = null;
        universe.dustParticles = [];
        universe.explosionParticles = [];
        changeState(STATES.INIT);
    });
}

function draw() {
    universe.draw();

    if (currentState === STATES.SELECT_POSITION && targetPos) {
        noFill();
        stroke(255, 255, 255, 120);
        strokeWeight(1);
        circle(targetPos.x, targetPos.y, 25 + sin(frameCount * 0.1) * 8);
    }

    if (currentState === STATES.STAR_FORMATION) {
        this.formationTimer = (this.formationTimer || 350) - 1;
        if (this.formationTimer <= 0) {
            this.formationTimer = 350;
            changeState(STATES.OBSERVATION);
        }
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

function mousePressed() {
    if (currentState === STATES.SELECT_POSITION) {
        targetPos = { x: mouseX, y: mouseY };
        setTimeout(() => {
            changeState(STATES.SET_PARAMETERS);
        }, 800);
    }
}

function changeState(newState) {
    if (screens[currentState]) {
        screens[currentState].classList.remove('active');
    }

    currentState = newState;

    if (screens[currentState]) {
        screens[currentState].classList.add('active');
    }

    if (newState === STATES.BIG_BANG) {
        universe.bigBangTimer = 60;
        universe.shake(20);
        universe.initDustParticles();
    }

    if (newState === STATES.END) {
        let msg = "星は、宇宙へ還りました。";
        if (universe.targetStar.mass > 90) {
            msg = "星は重力に屈し、漆黒の深淵となりました。";
        } else if (universe.targetStar.mass > 50) {
            msg = "星は、その役目を終えました。";
        }
        document.getElementById('end-message').innerText = msg;
    }

    if (newState === STATES.BLACK_HOLE_SINK) {
        universe.sinkAlpha = 0;
    }

    console.log("State changed to:", newState);
}
