/* IDE related HTML elements that JS can't really find on it's own */
const memoryBank  = $('.simplebar-content')[0];
const sscheckbox  = $('#superspeed')[0];
/* regex rules for the IDE editor. */
const BFre = /\+|-|<|>|\[|\]|,|\./g;
const BRNB = ["-", "+", "<", ">"];

/* A beautiful sleep function for JS */
const sleep = delay => new Promise(resolve => setTimeout(resolve, delay));

/* Variables for the interpreter */
var running    = false;
var paused     = false;
var ptr        = 0;
var inPtr      = 0;
var prevPtr    = 0;
var prevInPtr  = 0;

async function run() {
    if (!running && !paused) reset();

    if (!running || paused) {
        running = true; paused = false;
        
        runLabel.innerHTML = "Pause";
        runButton.className = runButton.className.replace('play', "pause");
        stopLabel.style  = "transform: translateY(0); opacity: 1; transition: transform .25s, opacity .5s;";
        stopButton.style = "transform: translateY(0); opacity: 1; transition: transform .25s, opacity .5s;";
    }
    else pause();

    while (running && !paused && ptr < editor.value.length) {
        execute();
        if (settings.superspeed) {
            execute();
            execute();
            execute();
            execute();
            execute();
            execute();
            execute();
            execute();
            execute();
        }
        await sleep(settings.speed * 1000);
    }

    if (!paused) stop();
}

function step() {
    if (!running && !paused) reset();
    pause();
    execute();
}

function execute() {
    let char = editor.value[ptr];
    while (char.search(BFre) !== 0) {
        ptr++;
        char = editor.value[ptr];
    }

    editorOverlay.children[prevPtr].className = editorOverlay.children[prevPtr].className.replace(' selected', "");
    editorOverlay.children[ptr].className += " selected";
    prevPtr = ptr;

    if (char === '-') cell.add(-1);
    if (char === '+') cell.add(1);
    if (char === '>') cell.select(cell.pos + 1);
    if (char === '<') cell.select(cell.pos - 1);

    if (char === '.') cell.read();
    if (char === ',') cell.write();

    if (char === '[') {
        if (cell.get() == 0) {
            let callstack = 1;
            for (let i = ptr + 1; i < editor.value.length; i++) {
                if (editor.value[i] === '[') callstack++;
                if (editor.value[i] === ']') callstack--;
                if (callstack === 0) { var jumpPos = i; break; }
            }
            if (callstack) {
                output.value = `ERROR\n"[" at ${ptr} does not have a matching "]"`;
                stop();
            }
            ptr = jumpPos;
        }
    }
    if (char === ']') {
        if (cell.get() != 0) {
            let callstack = 1;
            for (let i = ptr - 1; i > -1; i--) {
                if (editor.value[i] === ']') callstack++;
                if (editor.value[i] === '[') callstack--;
                if (callstack === 0) { var jumpPos = i; break}
            }
            if (callstack) {
                output.value = `ERROR\n"]" at ${ptr} does not have a matching "["`;
                stop();
            }
            ptr = jumpPos;
        }
    }
    ptr++;
}

editor.addEventListener('keydown', e => {
    if (e.key == 'Tab') {
        e.preventDefault();
        let selStt = editor.selectionStart;
        let selEnd = editor.selectionEnd;
        remove(selStt, selEnd);

        insert(" ".repeat(settings.indentSize), selStt);
    }
});
input.addEventListener('keydown', e => {
    if (e.key == 'Tab') {
        e.preventDefault();
        let selStt = editor.selectionStart;
        let selEnd = editor.selectionEnd;
        input.value = input.value.slice(0, selStt) + (" ".repeat(settings.indentSize)) + input.value.slice(selEnd + 1, input.value.length);
    }
});

function onEdit(event) {
    event.preventDefault();
    /* console.log(event.inputType); */
    reset();

    let selStt = editor.selectionStart;
    let selEnd = editor.selectionEnd;

    remove(selStt, selEnd);

    if (event.inputType === 'insertText') {
        if (!event.data.search(BFre)) {
            let string = event.data;
            let pos = 0;
            if (![event.data, " ", "\n", undefined, '['].includes(editor.value[selStt - 1])) string = " " + string
            if (event.data === '[') { string += "]"; pos--; }
            else if (event.data === ']' && editor.value[selStt] === ']') { string = ""; pos = 1; }
            if (![event.data, " ", "\n", undefined, ']'].includes(editor.value[selStt]) &&
            !(event.data === '[' && editor.value[selStt] === ']')) { string += " "; pos--; }
            insert(string, selStt, pos);
        }
        else insert(event.data, selStt);
    }
    if (event.inputType === 'insertLineBreak') {
        let indent = getIndention(selStt);
        if (editor.value[selStt - 1] === '[') {
            if (editor.value[selStt] === ']') insert("\n" + " ".repeat(indent) + " ".repeat(settings.indentSize) + "\n" + " ".repeat(indent), selStt, -1 - indent);
            else insert("\n" + " ".repeat(indent) + " ".repeat(settings.indentSize), selStt, -indent);
        }
        else insert("\n" + " ".repeat(indent), selStt);
    }
    if (event.inputType === 'insertFromPaste') insert(event.data, selStt);
    if (selStt === selEnd) {
        if (event.inputType === 'deleteContentBackward') {
            if (editor.value[selStt - 1] === ' ') {
                let noSpaces = 0;
                for (let i = selStt - 1; i > -1; i--) {
                    if (editor.value[i] === '\n') break;
                    if (editor.value[i] === ' ') noSpaces++;
                    else { noSpaces = 1; break; }
                }
                remove(selStt - Math.min(noSpaces, settings.indentSize), selEnd);
            }
            else if (editor.value[selStt - 1] === '[' && editor.value[selEnd] === ']') remove(selStt - 1, selEnd + 1);
            else remove(selStt - 1, selEnd);
        }
        if (event.inputType === 'deleteContentForward') remove(selStt, selEnd + 1);
        if (event.inputType === 'deleteWordBackward') {
            charI = editor.value[selStt - 1];
            if (["[", "]", "\n"].includes(charI)) {}
            else if (BRNB.includes(charI)) { for (let i = selStt - 1; i > -1; i--) { if (editor.value[i] === charI) selStt--; else break; } }
            else if (charI === ' ') { for (let i = selStt - 1; i > -1; i--) { if (editor.value[i] === ' ') selStt--; else break; } }
            else { for (let i = selStt - 1; i > -1; i--) { if (editor.value[i].search(BFre)) selStt--; else break; } }

            if (selStt === selEnd) selStt--;
            remove(selStt, selEnd);
        }
        if (event.inputType === 'deleteSoftLineBackward') {
            for (let i = selStt - 1; i > -1; i--) { if (editor.value[i] === '\n') break; else selStt--; }
            if (selStt === selEnd) selStt--;
            remove(selStt, selEnd);
        }
    }

    try {
        if (editorOverlay.children[editorOverlay.children.length - 1].innerHTML === '\n') {
            let endCap = document.createElement('span');
            endCap.innerHTML = " ";
            editorOverlay.insertBefore(endCap, editorOverlay.children[editorOverlay.children.length]);
        }
    } catch {}

    /* insertText, insertLineBreak, insertFromPaste */
    /* deleteContentBackward, deleteContentForward, deleteWordBackword, deleteWordForward, deleteSoftLineBackward */

    $('#editOver').scrollTop($('#editor').scrollTop());
    $('#editOver').scrollLeft($('#editor').scrollLeft());
}

function remove(stt, end) {
    editor.value = editor.value.slice(0, Math.max(stt, 0)) + editor.value.slice(end, editor.value.length);
    for (let i = end - 1; i > stt - 1; i--) { editorOverlay.removeChild(editorOverlay.children[i]); }

    editor.selectionStart = editor.selectionEnd = stt;
}

function insert(text, pos, cursor = 0) {
    for (let i = 0; i < text.length; i++) {
        let char = text[i]
        editor.value = editor.value.slice(0, pos + i) + char + editor.value.slice(pos + i, editor.value.length);

        let span = document.createElement('span')
        if (char === '+' || char === '-') { span.className = "addsub"; }
        if (char === '<' || char === '>') { span.className = "move"; }
        if (char === '[' || char === ']') { span.className = "jump"; }
        if (char === '.') { span.className = "output"; }
        if (char === ',') { span.className = "input"; }
        if (char === ' ') { span.className = "space"; }
        if (char === '\n') { span.innerHTML = "&#10;"; }
        else { span.innerHTML = char; }

        editorOverlay.insertBefore(span, editorOverlay.children[pos + i]);

    }
    editor.selectionStart = editor.selectionEnd = pos + text.length + cursor;
}

function getIndention(pos) {
    let NoSpaces = 0;
    for (let i = pos - 1; i > -1; i--) {
        if (editor.value[i] === '\n') { break; }
        if (editor.value[i] === ' ') { NoSpaces++; }
        else { NoSpaces = 0; }
    }

    return NoSpaces;
}

function pause() {
    paused = true;
    
    runLabel.innerHTML = "Run"
    runButton.className = runButton.className.replace('pause', "play");
    stopLabel.style  = "transform: translateY(0); opacity: 1; transition: transform .25s, opacity .5s;";
    stopButton.style = "transform: translateY(0); opacity: 1; transition: transform .25s, opacity .5s;";
}

function stop() {
    running = paused = false;

    runLabel.innerHTML = "Run"
    runButton.className = runButton.className.replace('pause', "play");
    stopLabel.style  = "transform: translateY(-100%); opacity: 0; transition: transform .5s, opacity .25s;";
    stopButton.style = "transform: translateY(-100%); opacity: 0; transition: transform .5s, opacity .25s;";
}

function reset() {
    stop();
    ptr = prevPtr = inPtr = prevInPtr = 0;

    for (let i = 0; i < editorOverlay.children.length; i++) editorOverlay.children[i].className = editorOverlay.children[i].className.replace(' selected', "");
    for (let i = 0; i < memoryBank.children.length; i++) memoryBank.children[i].innerHTML = "0";
    cell.select(0);

    inputOverlay.innerHTML = "";
    for (let i = 0; i < input.value.length; i++) {
        let span = document.createElement('span');
        input.value[i] === '\n' ? span.innerHTML = "&#10;" : span.innerHTML = " ";
        inputOverlay.appendChild(span);
    }

    output.value = "";
}

class cell {
    constructor() { this.pos = 0; }

    select(pos) {
        if (pos > memoryBank.children.length - 1) {
            for (let i = 0; i < 5; i++) {
                let newCell = document.createElement('div');
                newCell.className = "cell";
                newCell.innerHTML = "0";
                memoryBank.appendChild(newCell);
            }
        }

        memoryBank.children[this.pos].className = memoryBank.children[this.pos].className.replace(' selected', "");
        try { memoryBank.children[pos].className += " selected"; }
        catch (err) {
            console.log(err);
            if (pos < 0) { output.value = "ERROR\nMemory underflow."; }
            return stop();
        }
        this.pos = pos;   
    }

    get() { return memoryBank.children[this.pos].innerHTML; }

    add(i) {
        let newI = parseInt(memoryBank.children[this.pos].innerHTML) + i;
        if (newI < 0) newI = 255;
        if (newI > 255) newI = 0;
        memoryBank.children[this.pos].innerHTML = newI;
    }

    read() {
        output.value += String.fromCharCode(parseInt(memoryBank.children[this.pos].innerHTML));
        output.scrollTop = output.scrollHeight;
    }

    write() {
        if (isNaN(input.value.charCodeAt(inPtr))) memoryBank.children[this.pos].innerHTML = 0;
        else memoryBank.children[this.pos].innerHTML = input.value.charCodeAt(inPtr) % 255;

        try {
            inputOverlay.children[prevInPtr].className = inputOverlay.children[prevInPtr].className.replace(' selected', "");
            inputOverlay.children[inPtr].className += " selected";
        } catch {}

        prevInPtr = inPtr;
        inPtr++;
    }
}
cell = new cell();

editor.addEventListener('beforeinput', onEdit);

function badass() {
    this.badassmode = document.getElementById('BAM').checked;
    if (this.badassmode) {
        document.title = "Brainfuck!";
        title.innerHTML = "Brainfuck!";
        BAMLabel.innerHTML = "Badass mode";
        credits.children[6].innerHTML = credits.children[6].innerHTML.replace("Brainf*ck", "Brainfuck");
    } else {
        document.title = "Brainf*ck!";
        title.innerHTML = "Brainf*ck!";
        BAMLabel.innerHTML = "Bad*ss mode";
        credits.children[6].innerHTML = credits.children[6].innerHTML.replace("Brainfuck", "Brainf*ck");
    }
}

settings = {
    _speed: 0.2,
    set speed(i) {
        speedSlider.value = i;
        this._speed = i / 20; if (this._speed === 0) this._speed += 0.001;

        document.getElementById('speedLabel').innerHTML = `Delay: ${this._speed}s`;
        localStorage.setItem('speed', i);
    },
    get speed() { return this._speed },

    _cellStyle: "stacked",
    set cellStyle(n) {
        this._cellStyle = cellStyle.value = n;
        if (n === 'stacked') memory.className = memory.className.replace('button', "stacked");
        else if (n === 'button') memory.className = memory.className.replace('stacked', "button");

        localStorage.setItem('cellStyle', n);
    },
    get cellStyle() { return this._cellStyle; },

    _indentSize: 2,
    set indentSize(i) {
        this._indentSize = indentBar.value = i;
        indentBarLabel.innerHTML = `Indent size: ${i} space${i === "1" ? "" : "s"}`;
        localStorage.setItem('indentSize', i)
    },
    get indentSize() { return this._indentSize; },

    _superspeed: false,
    set superspeed(b) { this._superspeed = b; },
    get superspeed() { return this._superspeed; },

    _style: "ablyss",
    set style(n) {
        this._style = styleMenu.value = n;
        let primary = "#242A44"; let secondary = "#10131E"; let tertiary = "#212538";
        let border1 = "#212538"; let border2   = "#10131E";
        let button  = "#FFFFFF"; let highlight = "#394060"; let text     = "#FFFFFF";
        let comment = "#FFFFFF"; let addsub    = "#FFD27F"; let move     = "#7F7FFF";
        let jump    = "#BF7FBF"; let input     = "#FFFF7F"; let output   = "#C7F6CF";

        if (n === 'asphalt') {
            primary = "#1F1F1F"; secondary = "#181818"; tertiary = "#242424";
            border1 = "#242424"; border2   = "#181818";
            button  = "#D7D7D7"; highlight = "#37373D"; text     = "#CCCCCC";
            comment = "#6A9955"; addsub    = "#4EC9B0"; move     = "#3F9CD6";
            jump    = "#DA70D6"; input     = "#F1D700"; output   = "#CCCCCC";
        }
        else if (n === 'kammaroon') {
            primary = "#5F4135"; secondary = "#261D1D"; tertiary = "#6C3C2D";
            border1 = "#6C3C2D"; border2   = "#261D1D";
            button  = "#F19651"; highlight = "#E06424"; text     = "#E9904F";
            comment = "#FFFFFF"; addsub    = "#67FFBF"; move     = "#945DFF";
            jump    = "#DE97DB"; input     = "#FFF95E"; output   = "#91FF8B";
        }
        else if (n === 'neored') {
            primary     = secondary = tertiary = "#000000";
            border1     = border2   = button   = text 
            = comment   = addsub    = move     = jump 
            = input     = output    = "#FF1818";
            highlight   = "#181818";
        }
        else if (n === 'neoneo') {
            primary     = secondary = tertiary = "#000000";
            border1     = border2   = button   = text 
            = comment   = addsub    = move     = jump 
            = input     = output    = "#18FF18";
            highlight   = "#181818";
        }
        else if (n === 'neoblu') {
            primary     = secondary = tertiary = "#000000";
            border1     = border2   = button   = text 
            = comment   = addsub    = move     = jump 
            = input     = output    = "#3838FF";
            highlight   = "#181818";
        }
        document.documentElement.style.setProperty('--primary-color',   primary);
        document.documentElement.style.setProperty('--secondary-color', secondary);
        document.documentElement.style.setProperty('--tertiary-color',  tertiary);
        document.documentElement.style.setProperty('--border-color-1',  border1);
        document.documentElement.style.setProperty('--border-color-2',  border2);
        document.documentElement.style.setProperty('--button-color',    button);
        document.documentElement.style.setProperty('--highlight-color', highlight);
        document.documentElement.style.setProperty('--text-color',      text);

        document.documentElement.style.setProperty('--comment', comment);
        document.documentElement.style.setProperty('--addsub',  addsub);
        document.documentElement.style.setProperty('--move',    move);
        document.documentElement.style.setProperty('--jump',    jump);
        document.documentElement.style.setProperty('--input',   input);
        document.documentElement.style.setProperty('--output',  output);

        localStorage.setItem('style', n);
    },
    get style() { return this._style; }
}


/*
!TODO File handling
*/

