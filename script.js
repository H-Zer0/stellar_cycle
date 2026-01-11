/**
 * Stellar Cycle
 * Abstract space simulation with p5.js
 */

let universe;
let currentState = "INIT";
let targetPos = null;

// UI Elements
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
    constructor(x, y, isExplosion = false, mass = 50) {
        this.pos = createVector(x, y);
        if (isExplosion) {
            let angle = random(TWO_PI);
            let speed = random(1, map(mass, 0, 100, 5, 15));
            this.vel = createVector(cos(angle) * speed, sin(angle) * speed);
        } else {
            this.vel = createVector(random(-1, 1), random(-1, 1));
        }
        this.acc = createVector(0, 0);
        this.size = random(0.5, 3);
        this.alpha = random(100, 255);
        this.baseX = x;
        this.baseY = y;
        this.isExplosion = isExplosion;
        this.friction = 0.98;
    }

    applyForce(force) {
        this.acc.add(force);
    }

    update() {
        if (currentState === STATES.STAR_FORMATION) {
            let target = createVector(universe.targetStar.pos.x, universe.targetStar.pos.y);
            let dir = p5.Vector.sub(target, this.pos);
            let dist = dir.mag();
            if (dist < 5) {
                this.alpha -= 5;
            } else {
                dir.normalize();
                dir.mult(0.15);
                this.applyForce(dir);
                this.vel.add(this.acc);
                this.vel.limit(3);
                this.pos.add(this.vel);
                this.acc.mult(0);
            }
        } else if (this.isExplosion) {
            this.vel.mult(this.friction);
            this.pos.add(this.vel);
            this.alpha -= 1;
        } else {
            this.pos.x = this.baseX + sin(frameCount * 0.01 + this.alpha) * 5;
            this.pos.y = this.baseY + cos(frameCount * 0.01 + this.alpha) * 5;
        }
    }

    draw() {
        if (this.alpha <= 0) return;
        noStroke();
        fill(255, 255, 255, this.alpha);
        circle(this.pos.x, this.pos.y, this.size);
    }
}

class Star {
    constructor(x, y, mass, instability) {
        this.pos = createVector(x, y);
        this.mass = parseFloat(mass);
        this.instability = parseFloat(instability);
        this.size = 0;
        this.targetSize = map(this.mass, 0, 100, 15, 50);
        this.currentAlpha = 0;
        this.maxAlpha = 255;
        this.life = map(this.mass, 0, 100, 500, 1200);
        this.exploded = false;
        this.seed = random(1000);

        // 色の計算 (大質量:青白, 小質量:琥珀/赤)
        let c1 = color(255, 100, 50); // 赤色矮星
        let c2 = color(255, 255, 255); // 白
        let c3 = color(100, 180, 255); // 青色巨星

        let c;
        if (this.mass < 50) {
            c = lerpColor(c1, c2, map(this.mass, 0, 50, 0, 1));
        } else {
            c = lerpColor(c2, c3, map(this.mass, 50, 100, 0, 1));
        }

        // 先代の色の継承 (微かに)
        if (universe.legacyColor) {
            let lc = color(universe.legacyColor[0], universe.legacyColor[1], universe.legacyColor[2]);
            c = lerpColor(c, lc, 0.1);
        }

        this.col = [red(c), green(c), blue(c)];
    }

    update() {
        if (currentState === STATES.STAR_FORMATION) {
            if (this.size < this.targetSize) this.size += 0.12;
            if (this.currentAlpha < this.maxAlpha) this.currentAlpha += 3;
        } else if (currentState === STATES.OBSERVATION) {
            this.life -= 1;
            if (this.life <= 0) changeState(STATES.END);
        }
    }

    draw() {
        if (this.size <= 0) return;

        // 脈動ロジック
        let pulseSpeed = map(this.instability, 0, 100, 0.02, 0.12);
        let pulseAmp = map(this.instability, 0, 100, 1, 12);

        // 高不安定時は周期を不規則に
        let time = frameCount * pulseSpeed;
        if (this.instability > 70) {
            time += noise(frameCount * 0.05) * 5;
        }
        let pulse = sin(time) * pulseAmp;
        let currentSize = this.size + pulse;

        // 終焉ロジック
        if (currentState === STATES.END && !this.exploded) {
            if (this.mass > 90) {
                // ブラックホール・シナリオ
                changeState(STATES.BLACK_HOLE_SINK);
                this.exploded = true;
                universe.addNebula(this.pos.x, this.pos.y, this.col);
            } else if (this.mass > 50) {
                // 超新星爆発
                universe.explode(this.pos.x, this.pos.y, this.mass, this.col, "SUPERNOVA");
                this.exploded = true;
                this.size = 0;
                universe.addNebula(this.pos.x, this.pos.y, this.col);
            } else {
                // 惑星状星雲 / 消滅
                this.size -= 0.15;
                this.currentAlpha -= 3;
                if (frameCount % 5 === 0) {
                    universe.explosionParticles.push(new Particle(this.pos.x + random(-10, 10), this.pos.y + random(-10, 10), true, 10, this.col));
                }
                if (this.size <= 0) {
                    this.size = 0;
                    this.exploded = true;
                    universe.addNebula(this.pos.x, this.pos.y, this.col);
                }
            }
        }

        if (this.size > 0 && currentState !== STATES.BLACK_HOLE_SINK) {
            // 形状の歪み (不安定さ依存)
            push();
            translate(this.pos.x, this.pos.y);

            // 外側のグロー
            for (let i = 4; i > 0; i--) {
                fill(this.col[0], this.col[1], this.col[2], (this.currentAlpha / 12) / i);
                let gSize = (currentSize + (i * 20)) * (1 + (this.mass > 70 ? sin(frameCount * 0.1) * 0.05 : 0));
                circle(0, 0, gSize);
            }

            // 本体の描画 (不安定な場合は歪ませる)
            fill(this.col[0], this.col[1], this.col[2], this.currentAlpha);
            if (this.instability > 60) {
                beginShape();
                for (let a = 0; a < TWO_PI; a += 0.2) {
                    let offset = noise(cos(a) + 1, sin(a) + 1, frameCount * 0.02) * map(this.instability, 60, 100, 0, 15);
                    let r = currentSize / 2 + offset;
                    let x = cos(a) * r;
                    let y = sin(a) * r;
                    vertex(x, y);
                }
                endShape(CLOSE);
            } else {
                circle(0, 0, currentSize);
            }

            // 大質量星の回折ハレーション
            if (this.mass > 80) {
                stroke(this.col[0], this.col[1], this.col[2], 50);
                strokeWeight(1);
                let hLen = currentSize * 2;
                line(-hLen, 0, hLen, 0);
                line(0, -hLen, 0, hLen);
            }
            pop();
        } else if (currentState === STATES.BLACK_HOLE_SINK) {
            // ブラックホールの漆黒
            fill(0);
            stroke(255, 255, 255, 150);
            circle(this.pos.x, this.pos.y, currentSize * 0.8);
            noStroke();
            // 周囲の余韻光
            fill(this.col[0], this.col[1], this.col[2], 50);
            circle(this.pos.x, this.pos.y, currentSize * 1.5);
        }
    }
}

class Universe {
    constructor() {
        this.noiseOffset = 0;
        this.bgStars = [];
        this.dustParticles = [];
        this.explosionParticles = [];
        this.targetStar = null;
        this.shakeAmount = 0;
        this.initBackgroundStars();
    }

    initBackgroundStars() {
        for (let i = 0; i < 200; i++) {
            this.bgStars.push({
                x: random(width),
                y: random(height),
                size: random(0.5, 1.5),
                alpha: random(50, 150)
            });
        }
    }

    initDustParticles() {
        this.dustParticles = [];
        for (let i = 0; i < 400; i++) {
            let angle = random(TWO_PI);
            let r = random(width * 0.2, max(width, height));
            let x = this.targetStar.pos.x + cos(angle) * r;
            let y = this.targetStar.pos.y + sin(angle) * r;
            this.dustParticles.push(new Particle(x, y));
        }
    }

    explode(x, y, mass) {
        this.shake(25);
        this.explosionParticles = [];
        let count = map(mass, 0, 100, 200, 600);
        for (let i = 0; i < count; i++) {
            this.explosionParticles.push(new Particle(x, y, true, mass));
        }
    }

    shake(amount) {
        this.shakeAmount = amount;
    }

    draw() {
        push();
        if (this.shakeAmount > 0) {
            translate(random(-this.shakeAmount, this.shakeAmount), random(-this.shakeAmount, this.shakeAmount));
            this.shakeAmount *= 0.92;
            if (this.shakeAmount < 0.1) this.shakeAmount = 0;
        }

        background(5, 5, 5);

        noStroke();
        let resolution = 100;
        for (let x = 0; x < width + resolution; x += resolution) {
            for (let y = 0; y < height + resolution; y += resolution) {
                let n = noise(x * 0.003, y * 0.003, this.noiseOffset);
                fill(255, 255, 255, n * 10);
                rect(x, y, resolution, resolution);
            }
        }
        this.noiseOffset += 0.001;

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
        stroke(255, 255, 255, 100);
        circle(targetPos.x, targetPos.y, 20 + sin(frameCount * 0.1) * 5);
    }

    if (currentState === STATES.STAR_FORMATION) {
        // Automatically move to observation state after some time
        this.formationTimer = (this.formationTimer || 300) - 1;
        if (this.formationTimer <= 0) {
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

    // Logic for specific state entry
    if (newState === STATES.BIG_BANG) {
        universe.bigBangTimer = 60;
        universe.shake(15);
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
