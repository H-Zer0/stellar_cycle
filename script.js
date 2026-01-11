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
    constructor(x, y, options = {}) {
        this.pos = createVector(x, y);
        let speed = options.speed || random(1, 3);
        let angle = options.angle || random(TWO_PI);
        this.vel = options.isExplosion ? createVector(cos(angle) * speed, sin(angle) * speed) : createVector(random(-1, 1), random(-1, 1));
        this.acc = createVector(0, 0);
        this.size = options.size || random(0.5, 3);
        this.alpha = options.alpha || random(100, 255);
        this.baseColor = options.color || color(255);
        this.friction = options.friction || 0.98;
        this.lifeDecay = options.lifeDecay || 1;
        this.isNebula = options.isNebula || false;
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
                this.alpha -= 8;
            } else {
                dir.normalize();
                dir.mult(0.18);
                this.applyForce(dir);
                this.vel.add(this.acc);
                this.vel.limit(4);
                this.pos.add(this.vel);
                this.acc.mult(0);
            }
        } else {
            this.vel.mult(this.friction);
            this.pos.add(this.vel);
            this.alpha -= this.lifeDecay;

            if (this.isNebula) {
                // 星雲パーティクルのゆっくりとした不規則な動き
                this.pos.x += sin(frameCount * 0.01 + this.alpha) * 0.2;
                this.pos.y += cos(frameCount * 0.01 + this.alpha) * 0.2;
            }
        }
    }

    draw() {
        if (this.alpha <= 0) return;
        noStroke();
        let c = color(red(this.baseColor), green(this.baseColor), blue(this.baseColor));
        c.setAlpha(this.alpha);
        fill(c);
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

        // 寿命を延長 (400-1000 -> 800-2000)
        this.life = map(this.mass, 0, 100, 800, 2000);
        this.isDying = false;
        this.exploded = false;
        this.dead = false;

        // 色温度ロジック (質量ベース)
        this.baseColor = this.calculateStarColor();
    }

    calculateStarColor() {
        let r, g, b;
        if (this.mass > 70) {
            // 大質量: 青白色
            r = map(this.mass, 70, 100, 220, 180);
            g = map(this.mass, 70, 100, 230, 210);
            b = 255;
        } else if (this.mass > 40) {
            // 中等質量: 純白 〜 黄色
            r = 255;
            g = 255;
            b = map(this.mass, 40, 70, 200, 255);
        } else {
            // 低質量: 琥珀 〜 赤
            r = 255;
            g = map(this.mass, 0, 40, 80, 180);
            b = map(this.mass, 0, 40, 50, 100);
        }

        // 先代の残滓をブレンド
        if (universe.heritageColor) {
            r = lerp(r, red(universe.heritageColor), 0.15);
            g = lerp(g, green(universe.heritageColor), 0.15);
            b = lerp(b, blue(universe.heritageColor), 0.15);
        }

        return color(r, g, b);
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
        if (this.dead) return;

        // 期待される中心サイズと脈動
        let pulseSpeed = map(this.instability, 0, 100, 0.01, 0.1);
        let pulseAmp = map(this.instability, 0, 100, 2, 20);

        // 不安定さが高い場合、脈動を不規則にする
        let noiseVal = noise(frameCount * pulseSpeed);
        let pulse = sin(frameCount * pulseSpeed + noiseVal * this.instability * 0.1) * pulseAmp;
        let currentSize = this.size + pulse;

        if (currentState === STATES.END && !this.exploded) {
            this.handleEndSequence();
            return;
        }

        if (this.size > 0) {
            this.drawGlow(currentSize);
            this.drawCore(currentSize);
        }
    }

    drawCore(currentSize) {
        // 不安定さに応じた輪郭の歪み (Vertex Displacement)
        push();
        translate(this.pos.x, this.pos.y);
        noStroke();
        fill(this.baseColor);

        beginShape();
        let detail = 60;
        let distortionScale = map(this.instability, 0, 100, 0, 1.5);
        for (let i = 0; i < detail; i++) {
            let angle = map(i, 0, detail, 0, TWO_PI);
            let offset = noise(cos(angle) + 1, sin(angle) + 1, frameCount * 0.02) * (this.instability * 0.2);
            let r = (currentSize / 2) + offset * distortionScale;
            let x = cos(angle) * r;
            let y = sin(angle) * r;
            vertex(x, y);
        }
        endShape(CLOSE);
        pop();
    }

    drawGlow(currentSize) {
        // ハレーションの揺らぎ (大質量時)
        let glowCount = 6;
        let instabilityFactor = map(this.instability, 0, 100, 1, 2.5);

        for (let i = glowCount; i > 0; i--) {
            let flicker = noise(i, frameCount * 0.05) * (this.instability * 0.3);
            let alpha = (this.currentAlpha / glowCount) / (i * 1.5);
            let glowC = color(red(this.baseColor), green(this.baseColor), blue(this.baseColor), alpha);

            fill(glowC);
            circle(this.pos.x, this.pos.y, (currentSize + (i * 20)) * (1 + flicker * 0.01));
        }
    }

    handleEndSequence() {
        this.exploded = true;

        if (this.mass > 85) {
            // ブラックホール分岐
            universe.gravityCollapse(this.pos.x, this.pos.y, this.mass, this.baseColor);
            this.dead = true;
        } else if (this.mass > 40) {
            // 超新星爆発分岐
            universe.supernova(this.pos.x, this.pos.y, this.mass, this.baseColor);
            this.dead = true;
        } else {
            // 惑星状星雲分岐
            universe.nebulaRelease(this.pos.x, this.pos.y, this.mass, this.baseColor);
            this.dead = true;
        }

        // 宇宙の記憶に色を保存
        universe.heritageColor = this.baseColor;
    }
}

class Universe {
    constructor() {
        this.noiseOffset = 0;
        this.bgStars = [];
        this.dustParticles = [];
        this.effectParticles = [];
        this.remnants = []; // 星雲の残滓
        this.targetStar = null;
        this.shakeAmount = 0;
        this.heritageColor = null;
        this.bgBrightness = 10;
        this.blackHoleEffect = null;
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
            this.dustParticles.push(new Particle(x, y, { color: this.targetStar.baseColor }));
        }
    }

    supernova(x, y, mass, starColor) {
        this.shake(30);
        // 一瞬の閃光
        this.supernovaFlash = 100;

        // 収縮の後の爆発を表現するため、パーティクル生成を制御
        let count = map(mass, 40, 85, 400, 800);
        let colors = [
            color(80, 250, 123), // Emerald
            color(255, 184, 108), // Gold
            starColor
        ];

        for (let i = 0; i < count; i++) {
            let c = random(colors);
            this.effectParticles.push(new Particle(x, y, {
                isExplosion: true,
                speed: random(2, 12),
                size: random(1, 4),
                color: c,
                lifeDecay: random(0.5, 1.5),
                friction: 0.97
            }));
        }

        // 星雲の残滓を生成 (20秒 = 1200フレーム)
        this.createRemnant(x, y, starColor, 1200);
        this.bgBrightness = 25; // 宇宙が少し明るくなる
    }

    gravityCollapse(x, y, mass, starColor) {
        this.shake(50);
        this.blackHoleEffect = {
            x: x,
            y: y,
            size: 0,
            targetSize: 80,
            alpha: 255
        };

        let count = 500;
        for (let i = 0; i < count; i++) {
            this.effectParticles.push(new Particle(x, y, {
                isExplosion: true,
                speed: random(1, 20),
                size: random(1, 3),
                color: color(255),
                lifeDecay: 2
            }));
        }
        this.createRemnant(x, y, starColor, 1500);
    }

    nebulaRelease(x, y, mass, starColor) {
        // 煙のように剥がれ落ちる演出
        let count = 200;
        for (let i = 0; i < count; i++) {
            this.effectParticles.push(new Particle(x, y, {
                isExplosion: true,
                speed: random(0.2, 1.5),
                size: random(2, 5),
                color: starColor,
                lifeDecay: random(0.2, 0.5),
                isNebula: true,
                friction: 0.99
            }));
        }

        // 中心に残る白色矮星 (小さな白い芯)
        this.whiteDwarf = {
            x: x,
            y: y,
            size: 8,
            alpha: 255
        };

        this.createRemnant(x, y, starColor, 1000);
    }

    createRemnant(x, y, starColor, duration) {
        for (let i = 0; i < 150; i++) {
            this.remnants.push({
                pos: createVector(x + random(-100, 100), y + random(-100, 100)),
                vel: createVector(random(-0.2, 0.2), random(-0.2, 0.2)),
                color: starColor,
                alpha: random(20, 60),
                size: random(10, 50),
                life: duration
            });
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

        // 背景色の微調整 (継承された色とかすかに明るくなった宇宙)
        let bgR = 5;
        let bgG = 5;
        let bgB = 5;
        if (this.heritageColor) {
            bgR = lerp(5, red(this.heritageColor), 0.01);
            bgG = lerp(5, green(this.heritageColor), 0.01);
            bgB = lerp(5, blue(this.heritageColor), 0.01);
        }
        background(bgR, bgG, bgB);

        // 星雲の残滓 (霧のような表現)
        for (let i = this.remnants.length - 1; i >= 0; i--) {
            let r = this.remnants[i];
            r.pos.add(r.vel);
            r.life--;
            let a = map(r.life, 0, 100, 0, r.alpha);
            if (a < 0) a = 0;
            noStroke();
            fill(red(r.color), green(r.color), blue(r.color), a);
            circle(r.pos.x, r.pos.y, r.size);
            if (r.life <= 0) this.remnants.splice(i, 1);
        }

        noStroke();
        let resolution = 120;
        for (let x = 0; x < width + resolution; x += resolution) {
            for (let y = 0; y < height + resolution; y += resolution) {
                let n = noise(x * 0.003, y * 0.003, this.noiseOffset);
                fill(255, 255, 255, n * this.bgBrightness);
                rect(x, y, resolution, resolution);
            }
        }
        this.noiseOffset += 0.0008;

        for (let s of this.bgStars) {
            fill(255, 255, 255, s.alpha * (0.5 + 0.5 * sin(frameCount * 0.005 + s.x)));
            circle(s.x, s.y, s.size);
        }

        // 白色矮星の描画
        if (this.whiteDwarf) {
            this.whiteDwarf.alpha -= 0.5;
            if (this.whiteDwarf.alpha > 0) {
                fill(255, 255, 255, this.whiteDwarf.alpha);
                circle(this.whiteDwarf.x, this.whiteDwarf.y, this.whiteDwarf.size);
            }
        }

        // ブラックホールの描画
        if (this.blackHoleEffect) {
            if (this.blackHoleEffect.size < this.blackHoleEffect.targetSize) {
                this.blackHoleEffect.size += 4;
            } else {
                this.blackHoleEffect.alpha -= 2;
            }
            if (this.blackHoleEffect.alpha > 0) {
                fill(0, 0, 0, this.blackHoleEffect.alpha);
                circle(this.blackHoleEffect.x, this.blackHoleEffect.y, this.blackHoleEffect.size);
                noFill();
                stroke(255, 255, 255, this.blackHoleEffect.alpha * 0.5);
                strokeWeight(2);
                circle(this.blackHoleEffect.x, this.blackHoleEffect.y, this.blackHoleEffect.size + 4);
            }
        }

        for (let i = this.dustParticles.length - 1; i >= 0; i--) {
            let p = this.dustParticles[i];
            p.update();
            p.draw();
            if (p.alpha <= 0) this.dustParticles.splice(i, 1);
        }

        for (let i = this.effectParticles.length - 1; i >= 0; i--) {
            let p = this.effectParticles[i];
            p.update();
            p.draw();
            if (p.alpha <= 0) this.effectParticles.splice(i, 1);
        }

        if (this.targetStar) {
            this.targetStar.update();
            this.targetStar.draw();
        }

        pop();

        // Supernova Flash
        if (this.supernovaFlash > 0) {
            fill(255, 255, 255, this.supernovaFlash * 2.5);
            rect(0, 0, width, height);
            this.supernovaFlash -= 2;
        }

        if (currentState === STATES.BIG_BANG) {
            let flashAlpha = map(this.bigBangTimer, 0, 80, 255, 0);
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
        universe.effectParticles = [];
        universe.whiteDwarf = null;
        universe.blackHoleEffect = null;
        universe.bgBrightness = 10;
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
        this.formationTimer = (this.formationTimer || 300) - 1;
        if (this.formationTimer <= 0) {
            this.formationTimer = 300; // Reset for next time
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
        universe.bigBangTimer = 80;
        universe.shake(15);
        universe.initDustParticles();
    }

    if (newState === STATES.END) {
        let msg = "";
        if (universe.targetStar.mass > 85) {
            msg = "星は、その役目を終えました。";
        } else if (universe.targetStar.mass > 40) {
            msg = "星は、宇宙に新たな種を蒔きました。";
        } else {
            msg = "星は、静かに宇宙へ還りました。";
        }

        // メッセージ表示までの余韻を少し持たせるため、UI表示を遅延させることも可能だが
        // ここではメッセージの内容だけセットし、CSSのフェードインに任せる
        document.getElementById('end-message').innerText = msg;
    }

    console.log("State changed to:", newState);
}
