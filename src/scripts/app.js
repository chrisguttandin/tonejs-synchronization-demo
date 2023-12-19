import { Loop, MembraneSynth, MonoSynth, NoiseSynth, Part, PolySynth, Sequence, Synth, Transport, start } from 'tone';
import { TimingObject } from 'timing-object';
import { TimingProvider } from 'timing-provider';

const bass = new MonoSynth({
    envelope: {
        attack: 0.1,
        decay: 0.3,
        release: 2
    },
    filterEnvelope: {
        attack: 0.001,
        baseFrequency: 200,
        decay: 0.01,
        octaves: 2.6,
        sustain: 0.5
    },
    volume: -10
}).toDestination();
const bassPart = new Sequence(
    (time, note) => {
        bass.triggerAttackRelease(note, '16n', time);
    },
    ['C2', ['C3', ['C3', 'D2']], 'E2', ['D2', 'A1']],
    '4n'
);
const kick = new MembraneSynth({
    envelope: {
        attack: 0.02,
        decay: 0.8,
        sustain: 0
    },
    octaves: 10,
    pitchDecay: 0.01
}).toDestination();
const cChord = ['C4', 'E4', 'G4', 'B4'];
const dChord = ['D4', 'F4', 'A4', 'C5'];
const gChord = ['B3', 'D4', 'E4', 'A4'];
const kickPart = new Loop((time) => {
    kick.triggerAttackRelease('C2', '8n', time);
}, '2n');
const piano = new PolySynth(Synth, {
    oscillator: {
        partials: [1, 2, 1]
    },
    volume: -8
}).toDestination();
const pianoPart = new Part({
    callback: (time, chord) => {
        piano.triggerAttackRelease(chord, '8n', time);
    },
    events: [
        ['0:0:2', cChord],
        ['0:1', cChord],
        ['0:1:3', dChord],
        ['0:2:2', cChord],
        ['0:3', cChord],
        ['0:3:2', gChord]
    ],
    loop: true
});
const snare = new NoiseSynth({
    envelope: {
        attack: 0.001,
        decay: 0.2,
        sustain: 0
    },
    volume: -10
}).toDestination();
const snarePart = new Loop((time) => {
    snare.triggerAttack(time);
}, '2n');

bassPart.start(0);
kickPart.start(0);
pianoPart.start(0);
snarePart.start(0);

const $bpmInput = document.getElementById('bpm');
const $connectingMessageSpan = document.getElementById('connecting-message');
const $playerButton = document.getElementById('player');

// eslint-disable-next-line padding-line-between-statements
const convertBpmToVelocity = (value) => value / 60;

// eslint-disable-next-line padding-line-between-statements
const translateVector = (/*audioContext,*/ { acceleration, position, timestamp, velocity }) => {
    if (acceleration !== 0) {
        throw new Error('An acceleration other than zero is not yet supported.');
    }

    return {
        position: position + velocity * (performance.now() / 1000 - timestamp),
        velocity
    };
};

// eslint-disable-next-line padding-line-between-statements
const waitForConnection = () =>
    new Promise((resolve) => {
        const timingObject = new TimingObject(new TimingProvider('abcdefghijklmno56789'));
        const resolvePromiseWhenOpen = () => {
            timingObject.removeEventListener('readystatechange', resolvePromiseWhenOpen);

            if (timingObject.readyState === 'open') {
                resolve(timingObject);
            }
        };

        timingObject.addEventListener('readystatechange', resolvePromiseWhenOpen);
    });

waitForConnection().then((timingObject) => {
    $bpmInput.disabled = false;
    $connectingMessageSpan.style.display = 'none';
    $playerButton.disabled = false;

    const min = parseInt($bpmInput.min, 10);
    const max = parseInt($bpmInput.max, 10);

    // eslint-disable-next-line padding-line-between-statements
    const getBpm = () => Math.min(max, Math.max(min, Math.round(parseFloat($bpmInput.value))));

    // eslint-disable-next-line padding-line-between-statements
    const isTimingObjectMoving = () => {
        const { velocity } = timingObject.query();

        return velocity !== 0;
    };

    // eslint-disable-next-line padding-line-between-statements
    const restartTimer = () => {
        clearInterval(intervalId);
        startTimer();
    };

    // eslint-disable-next-line padding-line-between-statements
    const setBpm = (value) => {
        bpm = value;
        $bpmInput.value = value;
    };

    // eslint-disable-next-line padding-line-between-statements
    const updateTransport = () => {
        const { position, velocity } = translateVector(timingObject.query());

        Transport.seconds = position / velocity;
        Transport.bpm.value = velocity * 60;
    };

    // eslint-disable-next-line padding-line-between-statements
    const startTimer = () => {
        if (Transport.state === 'stopped') {
            Transport.start();
        }

        updateTransport();

        intervalId = setInterval(() => updateTransport(), 1000 + Math.random() * 1000);
    };

    // eslint-disable-next-line padding-line-between-statements
    const stopTimer = () => {
        clearInterval(intervalId);

        Transport.stop();

        intervalId = null;
    };

    // eslint-disable-next-line padding-line-between-statements
    const updateVelocity = (value) => timingObject.update({ velocity: convertBpmToVelocity(value) });

    let bpm = getBpm();
    let intervalId = null;

    $bpmInput.addEventListener('change', () => {
        const value = getBpm();

        setBpm(value);

        if (isTimingObjectMoving()) {
            updateVelocity(value);
        }

        if (intervalId !== null) {
            restartTimer();
        }
    });

    $playerButton.addEventListener('click', () => {
        if (intervalId === null) {
            $playerButton.textContent = 'mute player';

            if (!isTimingObjectMoving()) {
                updateVelocity(bpm);
            }

            start();
            startTimer();
        } else {
            $playerButton.textContent = 'unmute player';

            stopTimer();
        }
    });

    timingObject.addEventListener('change', () => {
        const { velocity } = timingObject.query();

        if (velocity === 0) {
            $playerButton.textContent = 'start player';

            if (intervalId !== null) {
                stopTimer();
            }
        } else {
            setBpm(Math.round(velocity * 60));

            if (intervalId === null) {
                $playerButton.textContent = 'unmute player';
            } else {
                restartTimer();
            }
        }
    });
});
