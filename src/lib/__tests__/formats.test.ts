import { describe, expect, it } from "vitest";
import { durationMsFromProbe } from "../backend";
import { kindOf, targetById, targetsFor } from "../formats";

describe("kindOf", () => {
  it("classifica por extensão; gif conta como vídeo (animado)", () => {
    expect(kindOf("C:/x/a.mp4")).toBe("video");
    expect(kindOf("C:/x/a.GIF")).toBe("video");
    expect(kindOf("C:/x/song.flac")).toBe("audio");
    expect(kindOf("C:/x/foto.JPEG")).toBe("image");
    expect(kindOf("C:/x/doc.docx")).toBe("document");
    expect(kindOf("C:/x/texto.md")).toBe("document");
    expect(kindOf("C:/x/planilha.pdf")).toBe(null); // pandoc não LÊ pdf
  });
});

describe("targetsFor", () => {
  it("vídeo oferece mp4/webm/mkv + extrair áudio, sem o formato que já é", () => {
    const ids = targetsFor("C:/x/a.webm")!.map((t) => t.id);
    expect(ids).toContain("mp4");
    expect(ids).toContain("mp3");
    expect(ids).not.toContain("webm"); // já é webm
  });

  it("áudio oferece os codecs de áudio, sem o próprio", () => {
    const ids = targetsFor("C:/x/a.mp3")!.map((t) => t.id);
    expect(ids).toContain("flac");
    expect(ids).toContain("wav");
    expect(ids).not.toContain("mp3");
  });

  it("imagem: jpg não aparece pra um .jpeg (mesmo formato)", () => {
    const ids = targetsFor("C:/x/foto.jpeg")!.map((t) => t.id);
    expect(ids).not.toContain("jpg");
    expect(ids).toContain("png");
    expect(ids).toContain("webp");
  });

  it("documento (docx) oferece os writers do pandoc via 'pandoc', sem o próprio", () => {
    const ts = targetsFor("C:/x/rel.docx")!;
    const ids = ts.map((t) => t.id);
    expect(ids).toContain("md");
    expect(ids).toContain("html");
    expect(ids).toContain("odt");
    expect(ids).not.toContain("docx"); // já é docx
    // Todos os alvos de documento passam pelo pandoc, com um writer `to`.
    expect(ts.every((t) => t.via === "pandoc" && !!t.to)).toBe(true);
  });

  it("apelidos de extensão contam como o mesmo formato (.markdown não oferece md; .htm não oferece html)", () => {
    expect(targetsFor("C:/x/a.markdown")!.map((t) => t.id)).not.toContain("md");
    expect(targetsFor("C:/x/a.htm")!.map((t) => t.id)).not.toContain("html");
    expect(targetsFor("C:/x/a.latex")!.map((t) => t.id)).not.toContain("latex");
  });

  it("PDF de entrada → null (pandoc não lê pdf; vem numa próxima leva)", () => {
    expect(targetsFor("C:/x/rel.pdf")).toBe(null);
  });
});

describe("via do alvo (motor certo)", () => {
  it("mídia é via ffmpeg (tem args), documento é via pandoc (tem to)", () => {
    expect(targetById("C:/x/a.mp4", "webm")!.via).toBe("ffmpeg");
    expect(typeof targetById("C:/x/a.mp4", "webm")!.args).toBe("function");
    expect(targetById("C:/x/a.docx", "md")!.via).toBe("pandoc");
    expect(targetById("C:/x/a.docx", "md")!.to).toBe("gfm");
  });
});

describe("args do alvo (o input é -i, a saída é o último)", () => {
  it("mp4 tem H.264 + faststart", () => {
    const a = targetById("C:/x/a.avi", "mp4")!.args!("C:/x/a.avi", "C:/x/a.mp4");
    expect(a[0]).toBe("-i");
    expect(a[1]).toBe("C:/x/a.avi");
    expect(a[a.length - 1]).toBe("C:/x/a.mp4");
    expect(a).toContain("libx264");
    expect(a).toContain("+faststart");
  });

  it("extrair áudio de vídeo usa -vn", () => {
    const a = targetById("C:/x/a.mp4", "mp3")!.args!("C:/x/a.mp4", "C:/x/a.mp3");
    expect(a).toContain("-vn");
    expect(a).toContain("libmp3lame");
  });
});

describe("durationMsFromProbe", () => {
  it("lê format.duration em segundos → ms", () => {
    expect(durationMsFromProbe('{"format":{"duration":"12.500"}}')).toBe(12500);
  });
  it("imagem/sem duração → 0, e json inválido não explode", () => {
    expect(durationMsFromProbe('{"format":{}}')).toBe(0);
    expect(durationMsFromProbe("nao é json")).toBe(0);
  });
});
