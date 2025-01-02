const editor     = document.getElementById('editor');
const input      = document.getElementById('input');
const output     = document.getElementById('output');
const editOver   = document.getElementById('editoroverlay');
const inputOver  = document.getElementById('inputoverlay');
const memory     = document.getElementsByClassName('simplebar-content')[0];
const speedbar   = document.getElementById('speedbar');
const cellstyle  = document.getElementById('cellstyle');
const stylemenu  = document.getElementById('stylemenu');
const sscheckbox = document.getElementById('superspeed');

const BFre = /\+|-|<|>|\[|\]|,|\./g;
const BRNB = ["-", "+", "<", ">"];

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

var running    = false;
var paused     = false;
var ptr        = 0;
var inPtr      = 0;
var prevPtr    = 0;
var prevInPtr  = 0;

async function run() {
    if (!running && !paused) reset();

    if (!running || paused) {
        running = true;
        paused = false;
        document.getElementById('runpause2').style = "transform: translateX(300%) translateY(0) rotateZ(0deg);";
        document.getElementById('runpause3').style = "transform: translateX(300%) translateY(0) rotateZ(0deg);";
        document.getElementById('stop').style      = "transform: translateY(0); opacity: 1; transition: transform .25s, opacity .5s;";
        document.getElementById('stoplabel').style = "transform: translateY(0); opacity: 1; transition: transform .25s, opacity .5s;";
        document.getElementById('runlabel').innerHTML = "Pause"
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

    editOver.children[prevPtr].className = editOver.children[prevPtr].className.replace(' selected', "");
    editOver.children[ptr].className += " selected";
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

editor.addEventListener('keydown', (e) => {
    if (e.key == 'Tab') {
        e.preventDefault()
        let selStt = editor.selectionStart;
        let selEnd = editor.selectionEnd;
        remove(selStt, selEnd);

        insert(" ".repeat(settings.indentsize), selStt);
    }
})

function onEdit(event) {
    event.preventDefault();
    console.log(event.inputType);
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
            if (editor.value[selStt] === ']') insert("\n" + " ".repeat(indent) + " ".repeat(settings.indentsize) + "\n" + " ".repeat(indent), selStt, -1 - indent);
            else insert("\n" + " ".repeat(indent) + " ".repeat(settings.indentsize), selStt, -indent);
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
                remove(selStt - Math.min(noSpaces, settings.indentsize), selEnd);
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
        if (editOver.children[editOver.children.length - 1].innerHTML === '\n') {
            let endCap = document.createElement('span');
            endCap.innerHTML = " ";
            editOver.insertBefore(endCap, editOver.children[editOver.children.length]);
        }
    } catch {}

    /* insertText, insertLineBreak, insertFromPaste */
    /* deleteContentBackward, deleteContentForward, deleteWordBackword, deleteWordForward, deleteSoftLineBackward */

    $('#editOver').scrollTop($('#editor').scrollTop());
    $('#editOver').scrollLeft($('#editor').scrollLeft());
}

function remove(stt, end) {
    editor.value = editor.value.slice(0, Math.max(stt, 0)) + editor.value.slice(end, editor.value.length);
    for (let i = end - 1; i > stt - 1; i--) { editOver.removeChild(editOver.children[i]); }

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

        editOver.insertBefore(span, editOver.children[pos + i]);

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
    document.getElementById('stop').style      = "transform: translateY(0); opacity: 1; transition: transform .25s, opacity .5s;";
    document.getElementById('stoplabel').style = "transform: translateY(0); opacity: 1; transition: transform .25s, opacity .5s;";
    document.getElementById('runpause2').style = "transform: translateX(100%) translateY(22.5%) rotateZ(60deg);";
    document.getElementById('runpause3').style = "transform: translateX(100%) translateY(-22.5%) rotateZ(-60deg);";
    document.getElementById('runlabel').innerHTML = "Run"
}

function stop() {
    running = paused = false;

    document.getElementById('runpause2').style = "transform: translateX(100%) translateY(22.5%) rotateZ(60deg);";
    document.getElementById('runpause3').style = "transform: translateX(100%) translateY(-22.5%) rotateZ(-60deg);";
    document.getElementById('stop').style = "transform: translateY(-100%); opacity: 0; transition: transform .5s, opacity .25s;";
    document.getElementById('stoplabel').style = "transform: translateY(-100%); opacity: 0; transition: transform .5s, opacity .25s;";
    document.getElementById('runlabel').innerHTML = "Run"
}

function reset() {
    stop();
    ptr = prevPtr = inPtr = prevInPtr = 0;

    for (let i = 0; i < editOver.children.length; i++) editOver.children[i].className = editOver.children[i].className.replace(' selected', "");
    for (let i = 0; i < memory.children.length; i++) memory.children[i].innerHTML = "0";
    cell.select(0);

    inputOver.innerHTML = "";
    for (let i = 0; i < input.value.length; i++) {
        let span = document.createElement('span');
        input.value[i] === '\n' ? span.innerHTML = "&#10;" : span.innerHTML = " ";
        inputOver.appendChild(span);
    }

    output.value = "";
}

class cell {
    constructor() { this.pos = 0; }

    select(pos) {
        if (pos > memory.children.length - 1) {
            for (let i = 0; i < 5; i++) {
                let newCell = document.createElement('div');
                newCell.className = "cell";
                newCell.innerHTML = "0";
                settings.cellstyle === "button" ? newCell.style.width = "40px" : newCell.style.width = "100%";
                memory.appendChild(newCell);
            }
        }

        memory.children[this.pos].className = memory.children[this.pos].className.replace(' selected', "");
        try { memory.children[pos].className += " selected"; }
        catch (err) {
            console.log(err);
            if (pos < 0) { output.value = "ERROR\nMemory underflow."; }
            return stop();
        }
        this.pos = pos;   
    }

    get() { return memory.children[this.pos].innerHTML; }

    add(i) {
        let newI = parseInt(memory.children[this.pos].innerHTML) + i;
        if (newI < 0) newI = 255;
        if (newI > 255) newI = 0;
        memory.children[this.pos].innerHTML = newI;
    }

    read() {
        output.value += String.fromCharCode(parseInt(memory.children[this.pos].innerHTML));
        output.scrollTop = output.scrollHeight;
    }

    write() {
        if (isNaN(input.value.charCodeAt(inPtr))) memory.children[this.pos].innerHTML = 0;
        else memory.children[this.pos].innerHTML = input.value.charCodeAt(inPtr);

        try {
            inputOver.children[prevInPtr].className = inputOver.children[prevInPtr].className.replace(' selected', "");
            inputOver.children[inPtr].className += " selected";
        } catch {}

        prevInPtr = inPtr;
        inPtr++;
    }
}
cell = new cell();

editor.addEventListener('beforeinput', onEdit);

function badass() {
    this.badassmode = document.getElementById('badassmode').checked;
    if (this.badassmode) {
        document.title = "Brainfuck!";
        document.getElementById('title').innerHTML = "Brainfuck!";
        document.getElementById('badassmodelabel').innerHTML = "Badass mode";
        document.getElementById('credits').children[6].innerHTML = document.getElementById('credits').children[6].innerHTML.replace("Brainf*ck", "Brainfuck");
    } else {
        document.title = "Brainf*ck!";
        document.getElementById('title').innerHTML = "Brainf*ck!";
        document.getElementById('badassmodelabel').innerHTML = "Bad*ss mode";
        document.getElementById('credits').children[6].innerHTML = document.getElementById('credits').children[6].innerHTML.replace("Brainfuck", "Brainf*ck");
    }
}

settings = {
    _speed: 0.2,
    set speed(i) {
        speedbar.value = i;
        this._speed = i / 20; if (this._speed === 0) this._speed += 0.001;

        document.getElementById('speedlabel').innerHTML = `Delay: ${this._speed}s`;
        localStorage.setItem('speed', i);
    },
    get speed() { return this._speed },

    _cellstyle: "stacked",
    set cellstyle(n) {
        this._cellstyle = cellstyle.value = n;
        if (n === 'stacked') $('.cell').css('width', '100%');
        else if (n === 'button') $('.cell').css('width', '40px');

        localStorage.setItem('cellstyle', n);
    },
    get cellstyle() { return this._cellstyle; },

    _indentsize: 2,
    set indentsize(i) {
        this._indentsize = indentbar.value = i;
        document.getElementById('indentbarlabel').innerHTML = `Indent size: ${i} space${i === "1" ? "" : "s"}`;
        localStorage.setItem('indentsize', i)
    },
    get indentsize() { return this._indentsize; },

    _superspeed: false,
    set superspeed(b) {
        this._superspeed = b;
        console.log(b);
    },
    get superspeed() { return this._superspeed; },

    _style: "ablyss",
    set style(n) {
        this._style = stylemenu.value = n;
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
            primary = secondary = tertiary = "#000000";
            border1 = border2   = button   = highlight
            = text  = comment   = addsub   = move 
            = jump  = input     = output   = "#FF1818";
        }
        else if (n === 'neoneo') {
            primary = secondary = tertiary = "#000000";
            border1 = border2   = button   = highlight
            = text  = comment   = addsub   = move 
            = jump  = input     = output   = "#18FF18";
        }
        else if (n === 'neoblu') {
            primary = secondary = tertiary = "#000000";
            border1 = border2   = button   = highlight
            = text  = comment   = addsub   = move 
            = jump  = input     = output   = "#3838FF";
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