// Import Matter.js
const { Engine, Render, Runner, Bodies, Composite, Events, Body, Mouse, MouseConstraint } = Matter;

// Physical constants
const w = 1100;
const h = 900;

const gravityScale = 0.9; // Adjust this value to tweak gravity
const simulationSpeed = 0.8; // Simulation speed multiplier

const STARTING_BALLS = 10;
let ballCount = STARTING_BALLS;
let ball;
const ballRestitution = 0.95; // Bounciness for the ball
const ballForce = 0.035;
const ballRadius = 12;
let ballStationaryTime = 0;
let ballOffScreenTime = 0;

const pegCount = 30;
const pegRadius = 12.1;
const topNoSpawnZone = 125;
const bottomNoSpawnZone = 75;
const horizontalNoSpawnZone = 50; // Adjusted to match the wall position
const minPegDistance = pegRadius * 2 + 5; // Minimum distance between pegs
let hitPegs = [];

let specialPegs = [];
const specialPegCount = 10;

const angleLimit = 10;
const minAngle = angleLimit * (Math.PI / 180); // Minimum angle in radians
const maxAngle = (180 - angleLimit) * (Math.PI / 180); // Maximum angle in radians

const trajectoryLineLength = 7;

const bucketWidth = 160;
const bucketHeight = 40;
const bucketSideWidth = 70;
const bucketSpeed = 5;
let bucketDirection = 1;

let showTrajectory = true;
let showReadyBall = true;

const ballCounterElement = document.getElementById('ballCounter');
const gameOverElement = document.getElementById('gameOver');
const congratulationsElement = document.getElementById('congratulations');

const pegHitLowSound = new Howl({
    src: ['peghit_low.wav']
});
const pegHitSound = new Howl({
    src: ['peghit.wav']
});
let pegHitPitch = 1;
const SPEED_THRESHOLD = 10;

const extraBallSound = new Howl({
    src: ['extraBall.wav']
});

function playPegHitSound(speed) {
    if (speed < SPEED_THRESHOLD) {
        pegHitLowSound.rate(pegHitPitch);
        pegHitLowSound.play();
    } else {
        pegHitSound.rate(pegHitPitch);
        pegHitSound.play();
    }
    pegHitPitch += 0.1; // Increase pitch
}

function updateBallCounter() {
    ballCounterElement.textContent = `Balls: ${ballCount}`;
}

function checkSpecialPegs() {
    console.log(specialPegs);
    
    if (specialPegs.length === 0) {
        congratulationsElement.style.display = 'block';
        ballCount = 0;
        updateBallCounter();
        showReadyBall = false;
        showTrajectory = false;
    }
}

function tryAgain() {
    gameOverElement.style.display = 'none';
    congratulationsElement.style.display = 'none';
    resetPegs();
    setTimeout(() => {
        ballCount = STARTING_BALLS;
        updateBallCounter();
        showReadyBall = true;
        showTrajectory = true;
    }, 500);
}

function resetPegs() {
    Composite.clear(world, false, true);
    Composite.add(world, [leftWall, rightWall, readyBall, firingRect, bucketLeft, bucketRight, bucketBottom]);
    specialPegs = [];
    for (let i = 0; i < pegCount; i++) {
        let x, y, validPosition;
        do {
            x = horizontalNoSpawnZone + pegRadius + Math.random() * (w - (horizontalNoSpawnZone * 2) - pegRadius * 2);
            y = topNoSpawnZone + pegRadius + Math.random() * (h - topNoSpawnZone - bottomNoSpawnZone - pegRadius * 2);
            validPosition = true;
            for (const peg of Composite.allBodies(world)) {
                if (peg.label === 'peg' || peg.label === 'specialPeg') {
                    const dx = peg.position.x - x;
                    const dy = peg.position.y - y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < minPegDistance) {
                        validPosition = false;
                        break;
                    }
                }
            }
        } while (!validPosition);

        const isSpecialPeg = specialPegs.length < specialPegCount;
        const peg = Bodies.circle(x, y, pegRadius, {
            isStatic: true,
            render: {
                fillStyle: isSpecialPeg ? 'red' : 'blue',
                strokeStyle: isSpecialPeg ? '#8b0000' : '#00008b',
                lineWidth: 5
            },
            label: isSpecialPeg ? 'specialPeg' : 'peg'
        });
        Composite.add(world, peg);
        if (isSpecialPeg) {
            specialPegs.push(peg);
        }
    }
}

// Create an engine
const engine = Engine.create();
const world = engine.world;
engine.gravity.scale = gravityScale * 0.001;

// Create a renderer
const render = Render.create({
    element: document.body,
    engine: engine,
    canvas: document.getElementById('world'),
    options: {
        width: w,
        height: h,
        wireframes: false
    }
});

Render.run(render);

// Create a runner
const runner = Runner.create();
Runner.run(runner, engine);

// Adjust simulation speed
engine.timing.timeScale = simulationSpeed;

// Add walls to bounce off the sides
const leftWall = Bodies.rectangle(horizontalNoSpawnZone / 2, h / 2 - 500, horizontalNoSpawnZone, h + 1000, { isStatic: true });
const rightWall = Bodies.rectangle(w - horizontalNoSpawnZone / 2, h / 2 - 500, horizontalNoSpawnZone, h + 1000, { isStatic: true });
Composite.add(world, [leftWall, rightWall]);

const ballRender = {
    fillStyle: 'grey',
    strokeStyle: '#555555',
    lineWidth: 5
}

// Add firing rectangle with ready ball
const readyBall = Bodies.circle(w / 2 + 50, 0, ballRadius, {
    isStatic: true,
    collisionFilter: { mask: 0 }, // Remove collision
    render: {
        ...ballRender,
        zIndex: 2 // Lower z-index for readyBall
    }
});

const firingRect = Bodies.rectangle(w / 2, 0, 100, (ballRadius * 2.0) + 7.0, {
    isStatic: true,
    collisionFilter: { mask: 0 }, // Remove collision
    render: {
        fillStyle: '#444444',
        zIndex: 3 // Higher z-index for firingRect
    }
});

// Add bucket
const Vertices = Matter.Vertices;
const bucketLeftVertices = [
    { x: 0, y: 0 },
    { x: -bucketSideWidth, y: bucketHeight },
    { x: 0, y: bucketHeight }
];
const centreLeft = Vertices.centre(bucketLeftVertices);

// Add bucket
const bucketLeft = Bodies.fromVertices(w / 2 - bucketWidth / 2 + centreLeft.x, h - bucketHeight + centreLeft.y, bucketLeftVertices, {
    isStatic: true,
    render: {
        fillStyle: 'green'
    }
});

const bucketRightVertices = [
    { x: 0, y: 0 },
    { x: bucketSideWidth, y: bucketHeight },
    { x: 0, y: bucketHeight }
];
const centreRight = Vertices.centre(bucketRightVertices);

const bucketRight = Bodies.fromVertices(w / 2 + bucketWidth / 2 + centreRight.x, h - bucketHeight + centreRight.y, bucketRightVertices, {
    isStatic: true,
    render: {
        fillStyle: 'green'
    }
});

const bucketBottom = Bodies.rectangle(w / 2, h, bucketWidth, 5, {
    isStatic: true,
    isSensor: true, // Make it a sensor to detect when the ball passes through
    render: {
        visible: true,
        fillStyle: 'green'
    }
});
Composite.add(world, [bucketLeft, bucketRight, bucketBottom]);

// Add pegs
resetPegs();

// Rotate the firing rectangle and ready ball as the mouse moves
document.addEventListener('mousemove', function(event) {
    const rect = render.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    let angle = Math.atan2(mouseY - firingRect.position.y, mouseX - firingRect.position.x);
    if (angle < minAngle) angle = minAngle;
    if (angle > maxAngle) angle = maxAngle;
    Body.setAngle(firingRect, angle);
    Body.setPosition(readyBall, {
        x: firingRect.position.x + Math.cos(angle) * 50,
        y: firingRect.position.y + Math.sin(angle) * 50
    });
});

// Fire the ball on mouse click
document.addEventListener('click', function(event) {
    if (!ball && showTrajectory && ballCount > 0) {
        ballCount--;
        updateBallCounter();
        const angle = firingRect.angle;
        const x = readyBall.position.x;
        const y = readyBall.position.y;
        ball = Bodies.circle(x, y, ballRadius, {
            restitution: ballRestitution, // Add restitution to make the ball bounce
            render: ballRender
        });
        Composite.add(world, ball);
        const forceX = Math.cos(angle) * ballForce;
        const forceY = Math.sin(angle) * ballForce;
        Body.applyForce(ball, ball.position, { x: forceX, y: forceY });
        Composite.remove(world, readyBall);
        hitPegs = [];
        showTrajectory = false;
        showReadyBall = false;
        ballStationaryTime = 0;
    }
});

// Lighten peg color when hit
Events.on(engine, 'collisionStart', function(event) {
    const pairs = event.pairs;
    pairs.forEach(pair => {
        if (pair.bodyA.label === 'peg' || pair.bodyB.label === 'peg' || pair.bodyA.label === 'specialPeg' || pair.bodyB.label === 'specialPeg') {
            const peg = pair.bodyA.label === 'peg' || pair.bodyA.label === 'specialPeg' ? pair.bodyA : pair.bodyB;
            peg.render.fillStyle = peg.label === 'specialPeg' ? 'orange' : '#add8e6'; // Lighten color or make orange for special pegs
            if (!hitPegs.includes(peg)) {
                hitPegs.push(peg);
                const speed = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2);
                playPegHitSound(speed); // Play sound based on ball speed
            }
            if (peg.label === 'specialPeg') {
                specialPegs = specialPegs.filter(p => p !== peg);
            }
        }
    });
});

// Check if ball goes through the bottom of the bucket
Events.on(engine, 'collisionStart', function(event) {
    const pairs = event.pairs;
    pairs.forEach(pair => {
        if ((pair.bodyA === bucketBottom && pair.bodyB === ball) || (pair.bodyB === bucketBottom && pair.bodyA === ball)) {
            ballCount++;
            updateBallCounter();
            extraBallSound.play();
        }
    });
});

// Remove ball and pegs when the ball drops off the bottom of the screen or is stationary
Events.on(engine, 'afterUpdate', function() {
    if (ball) {
        const velocity = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2);
        
        if (velocity < 0.01) {
            ballStationaryTime += engine.timing.lastDelta;
        } else {
            ballStationaryTime = 0;
        }

        if (ballStationaryTime > 200) {
            removeHitPegs(false);
        }

        if (ball.position.y > h) {
            ballOffScreenTime += engine.timing.lastDelta;
            if (ballOffScreenTime > 200) {
                Composite.remove(world, ball);
                ball = null;
                ballOffScreenTime = 0;
                pegHitPitch = 1; // Reset pitch to normal
                setTimeout(() => {
                    removeHitPegs(true, () => {
                        if (ballCount === 0) {
                            gameOverElement.style.display = 'block';
                            showReadyBall = false;
                            showTrajectory = false;
                        } else {
                            checkSpecialPegs();
                            showReadyBall = true;
                            showTrajectory = true;
                        }
                    });
                    ballStationaryTime = 0.0;
                }, 500);
            }
        } else {
            ballOffScreenTime = 0;
        }
    }
});

function removeHitPegs(reverse, completeFunction) {
    let delay = 0;
    const pegsToRemove = reverse ? hitPegs.slice().reverse() : hitPegs;
    for (let i = 0; i < pegsToRemove.length; i++) {
        setTimeout(() => {
            Composite.remove(world, pegsToRemove[i]);
        }, delay);
        if (i < 5) {
            delay += 120;
        } else {
            delay += 80; // Increase speed after 5 pegs
        }
    }
    if (completeFunction) {
        setTimeout(completeFunction, delay);
    }
}

// Move bucket left and right
Events.on(engine, 'beforeUpdate', function() {
    const bucketCenterX = (bucketLeft.position.x + bucketRight.position.x) / 2;
    const bucketEdgeOffset = bucketSideWidth / 2;
    if (bucketCenterX <= horizontalNoSpawnZone + bucketWidth / 2 + bucketEdgeOffset || bucketCenterX >= w - horizontalNoSpawnZone - bucketWidth / 2 - bucketEdgeOffset) {
        bucketDirection *= -1;
    }
    Body.translate(bucketLeft, { x: bucketSpeed * bucketDirection, y: 0 });
    Body.translate(bucketRight, { x: bucketSpeed * bucketDirection, y: 0 });
    Body.translate(bucketBottom, { x: bucketSpeed * bucketDirection, y: 0 });
});

// Render the trajectory line
Events.on(render, 'afterRender', function() {
    const context = render.context;

    if (showTrajectory) {
        const angle = firingRect.angle;
        const startX = firingRect.position.x + Math.cos(angle) * 50;
        const startY = firingRect.position.y + Math.sin(angle) * 50;
        context.beginPath();
        context.moveTo(startX, startY);

        let currentX = startX;
        let currentY = startY;
        let velocityX = Math.cos(angle) * ballForce;
        let velocityY = Math.sin(angle) * ballForce;

        const trajectoryLineLengthScaled = trajectoryLineLength * 1000;
        for (let i = 0; i < trajectoryLineLengthScaled; i++) {
            velocityY += gravityScale * 0.001 * 0.001;
            currentX += velocityX;
            currentY += velocityY;
            context.lineTo(currentX, currentY);
        }

        context.strokeStyle = 'red';
        context.lineWidth = 2;
        context.zIndex = 1;
        context.stroke();

        Composite.remove(world, firingRect);
        Composite.remove(world, readyBall);

        if (showReadyBall) {

            Composite.add(world, readyBall);

        }
        Composite.add(world, firingRect);

    }
});

updateBallCounter();
