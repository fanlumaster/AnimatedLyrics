import * as lyrics from "@applemusic-like-lyrics/lyric";
import "@applemusic-like-lyrics/core/style.css";
import {
  type LyricLine as RawLyricLine,
  parseLrc,
  parseLys,
  parseQrc,
  parseTTML,
  parseYrc,
} from "@applemusic-like-lyrics/lyric";
import GUI from "lil-gui";
import Stats from "stats.js";
import type { LyricLine } from "@applemusic-like-lyrics/core";
import {
  BackgroundRender,
  MeshGradientRenderer,
  PixiRenderer,
} from "@applemusic-like-lyrics/core";
import {
  DomLyricPlayer,
  type LyricLineMouseEvent,
} from "@applemusic-like-lyrics/core";
import type { spring } from "@applemusic-like-lyrics/core";
type SpringParams = spring.SpringParams;

(window as any).lyrics = lyrics;

const audio = document.createElement("audio");
audio.volume = 0.18;
audio.preload = "auto";

function hideFirstInterludeDots() {
  const interludeDotsElement = document.querySelector('[class*="interludeDots"]') as HTMLDivElement | null;
  if (interludeDotsElement) {
    interludeDotsElement.style.display = "none";
  }
}

function showFirstInterludeDots() {
  const interludeDotsElement = document.querySelector('[class*="interludeDots"]') as HTMLDivElement | null;
  if (interludeDotsElement) {
    interludeDotsElement.style.display = "flex";
  }
}

const debugValues = {
  lyric: new URL(location.href).searchParams.get("lyric") || "",
  music: new URL(location.href).searchParams.get("music") || "",
  album: new URL(location.href).searchParams.get("album") || "",
  enableSpring: true,
  bgFPS: 60,
  bgMode: new URL(location.href).searchParams.get("bg") || "mg",
  bgScale: 1,
  bgFlowSpeed: 2,
  bgPlaying: true,
  bgStaticMode: true,
  currentTime: 0,
  enableBlur: true,
  playing: false,
  async mockPlay() {
    this.playing = true;
    const startTime = Date.now();
    const baseTime = this.currentTime * 1000;
    while (this.playing && this.currentTime < 300) {
      const time = Date.now() - startTime;
      this.currentTime = (baseTime + time) / 1000;
      progress.updateDisplay();
      lyricPlayer.setCurrentTime(baseTime + time);
      await waitFrame();
    }
  },
  play() {
    this.playing = true;
    audio.load();
    audio.play();
    lyricPlayer.resume();
    showFirstInterludeDots();
  },
  pause() {
    this.playing = false;
    if (audio.paused) {
      audio.play();
      lyricPlayer.resume();
    } else {
      audio.pause();
      lyricPlayer.pause();
    }
  },
  fadeWidth: 0.5,
  lineSprings: {
    posX: {
      mass: 1,
      damping: 10,
      stiffness: 100,
      soft: false,
    } as SpringParams,
    posY: {
      mass: 1,
      damping: 15,
      stiffness: 100,
      soft: false,
    } as SpringParams,
    scale: {
      mass: 1,
      damping: 20,
      stiffness: 100,
      soft: false,
    } as SpringParams,
  },
};

debugValues.lyric = "./assets/lyrics.ttml";
debugValues.album = "./assets/Cover.jpg";
debugValues.music = "./assets/春日影 (MyGO!!!!! Ver.).mp3";

// debugValues.lyric = "./assets/约定 - 王菲.lrc";
// debugValues.album = "./assets/约定 - 王菲.jpg";
// debugValues.music = "./assets/约定 - 王菲.flac";

function recreateBGRenderer(mode: string) {
  window.globalBackground?.dispose();
  if (mode === "pixi") {
    window.globalBackground = BackgroundRender.new(PixiRenderer);
  } else if (mode === "mg") {
    window.globalBackground = BackgroundRender.new(MeshGradientRenderer);
  } else {
    throw new Error("Unknown renderer mode");
  }
  const bg = window.globalBackground;
  bg.setFPS(debugValues.bgFPS);
  bg.setRenderScale(debugValues.bgScale);
  bg.setStaticMode(debugValues.bgStaticMode);
  bg.getElement().style.position = "absolute";
  bg.getElement().style.top = "0";
  bg.getElement().style.left = "0";
  bg.getElement().style.width = "100%";
  bg.getElement().style.height = "100%";
  bg.setAlbum(debugValues.album);
}

audio.src = debugValues.music;
audio.load();

const gui = new GUI();
// Hide debug panel in default
gui.hide();
gui.close();

gui.title("AMLL 歌词测试页面");
gui
  .add(debugValues, "lyric")
  .name("歌词文件")
  .onFinishChange(async (url: string) => {
    lyricPlayer.setLyricLines(
      parseTTML(await (await fetch(url)).text()).lines.map(mapTTMLLyric)
    );
  });
gui
  .add(debugValues, "music")
  .name("歌曲")
  .onFinishChange((v: string) => {
    audio.src = v;
  });
gui
  .add(debugValues, "album")
  .name("专辑图片")
  .onFinishChange((v: string) => {
    window.globalBackground.setAlbum(v);
  });

const bgGui = gui.addFolder("背景");
bgGui
  .add(debugValues, "bgPlaying")
  .name("播放")
  .onFinishChange((v: boolean) => {
    if (v) {
      window.globalBackground.resume();
    } else {
      window.globalBackground.pause();
    }
  });
bgGui
  .add(debugValues, "bgMode", ["pixi", "mg"])
  .name("背景渲染器")
  .onFinishChange((v: string) => {
    recreateBGRenderer(v);
  });
bgGui
  .add(debugValues, "bgScale", 0.01, 1, 0.01)
  .name("分辨率比率")
  .onChange((v: number) => {
    window.globalBackground.setRenderScale(v);
  });
bgGui
  .add(debugValues, "bgFPS", 1, 60, 1)
  .name("帧率")
  .onFinishChange((v: number) => {
    window.globalBackground.setFPS(v);
  });
bgGui
  .add(debugValues, "bgFlowSpeed", 0, 10, 0.1)
  .name("流动速度")
  .onFinishChange((v: number) => {
    window.globalBackground.setFlowSpeed(v);
  });
bgGui
  .add(debugValues, "bgStaticMode")
  .name("静态模式")
  .onFinishChange((v: boolean) => {
    window.globalBackground.setStaticMode(v);
  });

{
  const animation = gui.addFolder("歌词行动画/效果");
  animation
    .add(debugValues, "fadeWidth", 0, 10, 0.01)
    .name("歌词渐变宽度")
    .onChange((v: number) => {
      lyricPlayer.setWordFadeWidth(v);
    });
  animation
    .add(debugValues, "enableBlur")
    .name("启用歌词模糊")
    .onChange((v: boolean) => {
      lyricPlayer.setEnableBlur(v);
    });
  animation
    .add(debugValues, "enableSpring")
    .name("使用弹簧动画")
    .onChange((v: boolean) => {
      lyricPlayer.setEnableSpring(v);
    });
  function addSpringDbg(name: string, obj: SpringParams, onChange: () => void) {
    const x = animation.addFolder(name);
    x.close();
    x.add(obj, "mass").name("质量").onFinishChange(onChange);
    x.add(obj, "damping").name("阻力").onFinishChange(onChange);
    x.add(obj, "stiffness").name("弹性").onFinishChange(onChange);
    x.add(obj, "soft")
      .name("强制软弹簧（当阻力小于 1 时有用）")
      .onFinishChange(onChange);
  }
  addSpringDbg("水平位移弹簧", debugValues.lineSprings.posX, () => {
    lyricPlayer.setLinePosXSpringParams(debugValues.lineSprings.posX);
  });
  addSpringDbg("垂直位移弹簧", debugValues.lineSprings.posY, () => {
    lyricPlayer.setLinePosYSpringParams(debugValues.lineSprings.posY);
  });
  addSpringDbg("缩放弹簧", debugValues.lineSprings.scale, () => {
    lyricPlayer.setLineScaleSpringParams(debugValues.lineSprings.scale);
  });
}

const playerGui = gui.addFolder("音乐播放器");
const progress = playerGui
  .add(debugValues, "currentTime")
  .min(0)
  .step(1)
  .name("当前进度")
  .onChange((v: number) => {
    audio.currentTime = v;
    lyricPlayer.setCurrentTime(v * 1000, true);
  });
playerGui.add(debugValues, "play").name("加载/播放");
playerGui.add(debugValues, "pause").name("暂停/继续");

const lyricPlayer = new DomLyricPlayer();

lyricPlayer.addEventListener("line-click", (evt) => {
  const e = evt as LyricLineMouseEvent;
  evt.preventDefault();
  evt.stopImmediatePropagation();
  evt.stopPropagation();
  console.log(e.line, e.lineIndex);
  audio.currentTime = e.line.getLine().startTime / 1000;
});

const stats = new Stats();
stats.showPanel(0);
// Hide stats panel in default
stats.dom.style.display = "none";
document.body.appendChild(stats.dom);
let lastTime = -1;
const frame = (time: number) => {
  stats.end();
  if (lastTime === -1) {
    lastTime = time;
  }
  if (!audio.paused) {
    const time = (audio.currentTime * 1000) | 0;
    debugValues.currentTime = (time / 1000) | 0;
    progress.max(audio.duration | 0);
    progress.updateDisplay();
    lyricPlayer.setCurrentTime(time);
  }
  lyricPlayer.update(time - lastTime);
  lastTime = time;
  stats.begin();
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);

declare global {
  interface Window {
    globalLyricPlayer: DomLyricPlayer;
    globalBackground:
    | BackgroundRender<PixiRenderer>
    | BackgroundRender<MeshGradientRenderer>;
  }
}

(window as any).globalLyricPlayer = lyricPlayer;

const waitFrame = (): Promise<number> =>
  new Promise((resolve) => requestAnimationFrame(resolve));
const mapLyric = (
  line: RawLyricLine,
  _i: number,
  _lines: RawLyricLine[]
): LyricLine => ({
  words: line.words.map((word) => ({ obscene: false, ...word })),
  startTime: line.words[0]?.startTime ?? 0,
  endTime:
    line.words[line.words.length - 1]?.endTime ?? Number.POSITIVE_INFINITY,
  translatedLyric: "",
  romanLyric: "",
  isBG: false,
  isDuet: false,
});

const mapTTMLLyric = (line: RawLyricLine): LyricLine => ({
  ...line,
  words: line.words.map((word) => ({ obscene: false, ...word })),
});

async function loadLyric() {
  const lyricFile = debugValues.lyric;
  const content = await (await fetch(lyricFile)).text();
  if (lyricFile.endsWith(".ttml")) {
    const lines = parseTTML(content).lines.map(mapTTMLLyric);
    console.log(lines);
    lyricPlayer.setLyricLines(lines);
  } else if (lyricFile.endsWith(".lrc")) {
    lyricPlayer.setLyricLines(parseLrc(content).map(mapLyric));
  } else if (lyricFile.endsWith(".yrc")) {
    lyricPlayer.setLyricLines(parseYrc(content).map(mapLyric));
  } else if (lyricFile.endsWith(".lys")) {
    lyricPlayer.setLyricLines(parseLys(content).map(mapLyric));
  } else if (lyricFile.endsWith(".qrc")) {
    lyricPlayer.setLyricLines(parseQrc(content).map(mapLyric));
  } else if (lyricFile === "bug") {
    const buildLyricLines = (
      lyric: string,
      startTime = 1000,
      otherParams: Partial<LyricLine> = {}
    ): LyricLine => {
      let curTime = startTime;
      const words = [];
      for (const word of lyric.split("|")) {
        const [text, duration] = word.split(",");
        const endTime = curTime + Number.parseInt(duration);
        words.push({
          word: text,
          startTime: curTime,
          endTime,
          obscene: false,
          romanWord: "",
        });
        curTime = endTime;
      }
      return {
        startTime,
        endTime: curTime + 3000,
        translatedLyric: "",
        romanLyric: "",
        isBG: false,
        isDuet: false,
        words,
        ...otherParams,
      };
    };

    const DEMO_LYRIC: LyricLine[] = [
      buildLyricLines(
        "Apple ,750|Music ,500|Like ,500|Ly,400|ri,500|cs ,250",
        1000
      ),
      buildLyricLines("BG ,750|Lyrics ,1000", 2000, {
        isBG: true,
      }),
      buildLyricLines("Next ,1000|Lyrics,1000", 2500, {
        // isDuet: true,
      }),
    ];

    lyricPlayer.setLyricLines(DEMO_LYRIC);
  }
}

(async () => {
  recreateBGRenderer(debugValues.bgMode);
  audio.style.display = "none";
  // lyricPlayer.getBottomLineElement().innerHTML = "Test Bottom Line";
  const player = document.getElementById("player");
  if (player) {
    player.appendChild(audio);
    player.appendChild(window.globalBackground.getElement());
    player.appendChild(lyricPlayer.getElement());
  }
  if (!debugValues.enableSpring) {
    lyricPlayer.setEnableSpring(false);
  }
  await loadLyric();

  // 暂停歌词播放器，防止间奏点在播放前动画
  hideFirstInterludeDots();
  lyricPlayer.pause();

  // debugValues.play();
  // debugValues.currentTime = 34;
  // debugValues.mockPlay();

  // 注释掉全局点击监听器，避免点击任何地方都触发播放
  // 现在只能通过播放按钮来触发播放
  // document.addEventListener(
  //   "click",
  //   (e) => {
  //     debugValues.play();
  //   },
  //   { once: true }
  // );

  document.addEventListener("keydown", (e) => {
    // Shift+D: 切换调试面板
    if (e.shiftKey && e.key.toLowerCase() === "d") {
      const isHidden = gui.domElement.style.display === "none";
      gui.domElement.style.display = isHidden ? "block" : "none";
      stats.dom.style.display = isHidden ? "block" : "none";
    }
    // Space: 切换播放/暂停
    else if (e.key === " " || e.code === "Space") {
      e.preventDefault(); // 防止页面滚动
      debugValues.pause(); // pause() 方法实际上是 toggle 播放/暂停
    }
  });

  let tapCount = 0;
  let lastTapTime = 0;
  document.addEventListener("touchend", (e) => {
    const touch = e.changedTouches[0];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = touch.clientX;
    const y = touch.clientY;
    if (x > vw - 200 && y > vh - 200) {
      const now = Date.now();
      if (now - lastTapTime < 800) {
        tapCount++;
      } else {
        tapCount = 1;
      }
      lastTapTime = now;
      if (tapCount >= 5) {
        tapCount = 0;
        const isHidden = gui.domElement.style.display === "none";
        gui.domElement.style.display = isHidden ? "block" : "none";
        stats.dom.style.display = isHidden ? "block" : "none";
      }
    } else {
      tapCount = 0;
    }
  });


  const playPrompt = document.getElementById("playPrompt") as HTMLDivElement | null;
  if (playPrompt) {
    setTimeout(() => playPrompt.style.display = "flex", 150);
  }
})();

const playPrompt = document.getElementById("playPrompt") as HTMLDivElement | null;
const playButton = document.getElementById("playButton") as HTMLButtonElement | null;

function startPlayback(): void {
  debugValues.play();
  if (playPrompt) {
    playPrompt.style.display = "none";
  }
}

if (playButton) {
  playButton.addEventListener("click", startPlayback);
}