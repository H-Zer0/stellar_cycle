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
        this.targetSize = map(this.mass, 0, 100, 15, 60);
        this.currentAlpha = 0;
        this.maxAlpha = 255;
        this.life = map(this.mass, 0, 100, 400, 1000); // 寿命
        this.isDying = false;
        this.exploded = false;
    }

    update() {
        if (currentState === STATES.STAR_FORMATION) {
            if (this.size < this.targetSize) this.size += 0.1;
            if (this.currentAlpha < this.maxAlpha) this.currentAlpha += 2;
        } else if (currentState === STATES.OBSERVATION) {
            this.life -= 1;
            if (this.life <= 0) {
                this.isDying = true;
                changeState(STATES.END);
            }
        }
    }

    draw() {
        if (this.size <= 0) return;

        // 脈動ロジック
        let pulseTarget = map(this.instability, 0, 100, 0.01, 0.08);
        let pulseAmp = map(this.instability, 0, 100, 2, 15);
        let pulse = sin(frameCount * pulseTarget) * pulseAmp;
        let currentSize = this.size + pulse;

        if (currentState === STATES.END && !this.exploded) {
            if (this.mass > 60) {
                // 超新星爆発
                universe.explode(this.pos.x, this.pos.y, this.mass);
                this.exploded = true;
                this.size = 0;
            } else {
                // 静かな終焉
                this.size -= 0.1;
                this.currentAlpha -= 2;
                if (this.size <= 0) this.size = 0;
            }
        }

        if (this.size > 0) {
            for (let i = 5; i > 0; i--) {
                fill(255, 255, 255, (this.currentAlpha / 10) / i);
                circle(this.pos.x, this.pos.y, currentSize + (i * 15));
            }
            fill(255, 255, 255, this.currentAlpha);
            circle(this.pos.x, this.pos.y, currentSize);
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
        // Delay end screen to let effects play
        let delay = (newState === STATES.END) ? 5000 : 0;
        setTimeout(() => {
            screens[newState].classList.add('active');
        }, delay);
    }

    // Logic for specific state entry
    if (newState === STATES.BIG_BANG) {
        universe.bigBangTimer = 60;
        universe.shake(15);
        universe.initDustParticles();
    }

    if (newState === STATES.END) {
        let msg = "";
        let type = universe.targetStar.endType;
        if (type === 'BLACK_HOLE') msg = "星の役目は、漆黒の深淵へと飲み込まれました。";
        else if (type === 'SUPERNOVA') msg = "星は、最後の輝きとともに、その欠片を宇宙へ放ちました。";
        else msg = "星は、静かに宇宙の塵へと還りました。";
        document.getElementById('end-message').innerText = msg;
    }

    console.log("State changed to:", newState);
}
