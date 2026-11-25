#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Редактор вики MysticRealities.

Запуск:  python wiki-editor.py     (положи файл в КОРЕНЬ вики — туда, где лежат index.html и папка articles;
         ничего устанавливать не нужно, нужен только Python с Tkinter).

Как это работает
  • Всё содержимое хранится в wiki-content.json. Редактор правит его, а кнопка «Собрать сайт» создаёт
    страницы articles/<имя>.html и обновляет в index.html три списка: меню слева, карточки категорий
    и список статей. Остальной код index.html, style.css, script.js редактор не трогает.
  • При первом запуске нажми «Импорт с сайта»: редактор прочитает текущие index.html и статьи.
    Статьи с необычной вёрсткой он не перезаписывает (помечаются «своя вёрстка»), но в списки добавляет.
  • Перед первой пересборкой рядом кладутся копии оригиналов: index.html.orig и articles/<имя>.html.orig.

Текст статьи пишется простой разметкой:
    ## Заголовок раздела            ### Подзаголовок
    Обычный абзац. **Жирный**, [ссылка](https://...), можно писать обычные HTML-теги.
    - пункт списка                  1. пункт нумерованного списка
    > цитата
    [[gallery Название: media/a.jpg | Подпись ; media/b.jpg | Подпись]]
    [[video Название: https://www.youtube.com/watch?v=XXXX | Подпись]]
"""
import copy
import html
import json
import os
import pathlib
import re
import shutil
import sys
import webbrowser
from html.parser import HTMLParser
import tkinter as tk
from tkinter import filedialog, messagebox, simpledialog, ttk

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(ROOT, "wiki-content.json")
INDEX_FILE = os.path.join(ROOT, "index.html")
ART_DIR = os.path.join(ROOT, "articles")
MEDIA_DIR = os.path.join(ART_DIR, "media")
GEN_MARK = "<!-- Страница создана wiki-editor.py. Меняй её через редактор: ручные правки при пересборке пропадут. -->"
NO_ARTICLES = '<div class="{cls}" style="color: #70575c; cursor: default; font-style: italic;">Статей пока нет</div>'


# ======================================================================= разметка статьи
def clean(s):
    return re.sub(r"\s+", " ", s or "").strip()


def esc(s):
    return html.escape(s or "", quote=True)


def inline(t):
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    return re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", r'<a href="\2">\1</a>', t)


def blocks_to_text(blocks):
    out = []
    for b in blocks:
        t = b["t"]
        if t == "h2":
            out.append("## " + b["text"])
        elif t == "h3":
            out.append("### " + b["text"])
        elif t == "p":
            out.append(b["text"])
        elif t == "quote":
            out.append("> " + b["text"])
        elif t == "ul":
            out.append("\n".join("- " + i for i in b["items"]))
        elif t == "ol":
            out.append("\n".join(f"{n}. {i}" for n, i in enumerate(b["items"], 1)))
        elif t in ("gallery", "video"):
            title = " " + b["title"] if b.get("title") else ""
            parts = []
            for item in b["items"]:
                src = item[0]
                cap = item[1] if len(item) > 1 else ""
                download = item[2] if len(item) > 2 else ""
                part = src
                if cap or download:
                    part += " | " + cap
                if download:
                    part += " | " + download
                parts.append(part)
            out.append(f"[[{t}{title}: " + " ; ".join(parts) + "]]")
    return "\n\n".join(out)


def text_to_blocks(text):
    blocks, para, lst = [], [], None

    def flush():
        nonlocal para, lst
        if para:
            blocks.append({"t": "p", "text": "<br>".join(para)})
        if lst:
            blocks.append(lst)
        para, lst = [], None

    for line in text.replace("\r\n", "\n").split("\n"):
        s = line.strip()
        if not s:
            flush()
        elif s.startswith("### "):
            flush(); blocks.append({"t": "h3", "text": s[4:].strip()})
        elif s.startswith("## "):
            flush(); blocks.append({"t": "h2", "text": s[3:].strip()})
        elif s.startswith("> "):
            flush(); blocks.append({"t": "quote", "text": s[2:].strip()})
        elif re.match(r"^[-•] ", s):
            if not lst or lst["t"] != "ul":
                flush(); lst = {"t": "ul", "items": []}
            lst["items"].append(s[2:].strip())
        elif re.match(r"^\d+\.\s+", s):
            if not lst or lst["t"] != "ol":
                flush(); lst = {"t": "ol", "items": []}
            lst["items"].append(re.sub(r"^\d+\.\s+", "", s))
        elif s.startswith("[["):
            flush()
            m = re.match(r"^\[\[(gallery|video)(?:\s+([^:\]]+?))?\s*:\s*(.*)\]\]$", s)
            if not m:
                raise ValueError(f"Не понял строку: {s[:70]}")
            items = []
            for part in m.group(3).split(";"):
                if part.strip():
                    fields = [x.strip() for x in part.split("|")]
                    src = fields[0]
                    cap = fields[1] if len(fields) > 1 else ""
                    download = fields[2] if len(fields) > 2 else ""
                    items.append([src, cap, download] if m.group(1) == "gallery" else [src, cap])
            blocks.append({"t": m.group(1), "title": (m.group(2) or "").strip(), "items": items})
        else:
            if lst:
                flush()
            para.append(s)
    flush()
    return blocks


def video_html(url, cap):
    m = re.search(r"(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|shorts/))([\w-]{6,})", url)
    if m:
        media = f'<iframe src="https://www.youtube.com/embed/{m.group(1)}" title="{esc(cap)}" allowfullscreen loading="lazy"></iframe>'
    elif re.search(r"\.(mp4|webm|ogg)(\?|$)", url, re.I):
        media = f'<video controls preload="metadata" src="{esc(url)}"></video>'
    else:
        media = f'<iframe src="{esc(url)}" title="{esc(cap)}" allowfullscreen loading="lazy"></iframe>'
    capt = f'\n                        <div class="video-caption">{inline(cap)}</div>' if cap else ""
    return f'                    <div class="video-item">\n                        {media}{capt}\n                    </div>'


def block_html(b):
    t = b["t"]
    if t in ("h2", "h3"):
        return f"            <{t}>{inline(b['text'])}</{t}>"
    if t == "p":
        return f"            <p>\n                {inline(b['text'])}\n            </p>"
    if t == "quote":
        return f"            <blockquote>{inline(b['text'])}</blockquote>"
    if t in ("ul", "ol"):
        lis = "\n".join(f"                <li>{inline(i)}</li>" for i in b["items"])
        return f"            <{t}>\n{lis}\n            </{t}>"
    if t == "gallery":
        figures = []
        for item in b["items"]:
            src = item[0]
            cap = item[1] if len(item) > 1 else ""
            download = item[2] if len(item) > 2 else ""
            image = f'<img src="{esc(src)}" alt="{esc(cap)}" loading="lazy">'
            if download:
                image = f'<a class="image-download" href="{esc(download)}" download>{image}</a>'
            figures.append(f'                    <figure>\n                        {image}\n'
                           + (f"                        <figcaption>{inline(cap)}</figcaption>\n" if cap else "")
                           + "                    </figure>")
        figs = "\n".join(figures)
        return (f'            <section class="media-section">\n                <h2>{esc(b.get("title") or "Фотогалерея")}</h2>\n'
                f'                <div class="gallery">\n{figs}\n                </div>\n            </section>')
    if t == "video":
        vids = "\n".join(video_html(src, cap) for src, cap in b["items"])
        return (f'            <section class="media-section">\n                <h2>{esc(b.get("title") or "Видео")}</h2>\n'
                f'                <div class="video-grid">\n{vids}\n                </div>\n            </section>')
    return ""


# ======================================================================= генерация страниц
def page_html(a, cat, st):
    g = st.get("giscus", {})
    has_box = bool(a.get("infobox") or a.get("infobox_image"))
    body = "\n\n".join(block_html(b) for b in a.get("blocks", []))
    video_items = a.get("video_items", [])
    video_section = ""
    if video_items:
        cards = []
        for item in video_items:
            src = esc(item.get("src", ""))
            title = esc(item.get("title", "Видео"))
            date = esc(item.get("date", ""))
            if re.search(r"\.(mp4|webm|ogg)(\?|$)", src, re.I):
                player = f'<video controls preload="metadata"><source src="{src}" type="video/mp4">Ваш браузер не поддерживает видео.</video>'
            elif re.search(r"(?:youtu\.be/|youtube\.com/)", src, re.I):
                m = re.search(r"(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|shorts/))([\w-]{6,})", src)
                player = f'<iframe src="https://www.youtube.com/embed/{m.group(1)}" title="{title}" allowfullscreen loading="lazy"></iframe>' if m else f'<iframe src="{src}" title="{title}" allowfullscreen loading="lazy"></iframe>'
            else:
                player = f'<video controls preload="metadata"><source src="{src}">Ваш браузер не поддерживает видео.</video>'
            date_html = f'<div class="video-caption">{date}</div>' if date else ""
            cards.append(f'''                    <div class="video-item">
                        <div class="video-caption" style="font-size:14px;font-weight:bold;color:var(--text);padding:12px 15px;border-bottom:1px solid var(--border);">{title}</div>
                        {player}
                        {date_html}
                    </div>''')
        video_section = '''            <section class="media-section" id="videos" style="margin-top:0;padding-top:0;border-top:none;">
                <div class="video-grid">
''' + "\n".join(cards) + '''
                </div>
            </section>'''
    rows = "\n".join(f"                <tr><th>{esc(k)}</th><td>{v}</td></tr>" for k, v in a.get("infobox", []))
    img = (f'            <img src="{esc(a["infobox_image"])}"\n                 alt="{esc(a["title"])}"\n                 class="infobox-image"\n                 loading="lazy">\n'
           if a.get("infobox_image") else "")
    box = (f'        <aside class="infobox">\n            <div class="infobox-title">{esc(a.get("infobox_title") or "КАРТОЧКА")}</div>\n{img}'
           f'            <table>\n{rows}\n            </table>\n        </aside>\n') if has_box else ""
    comments = ""
    if a.get("comments", True) and g.get("repo"):
        comments = f'''
<div class="comments-section">
    <h2>Комментарии</h2>
    <script src="https://giscus.app/client.js"
            data-repo="{esc(g["repo"])}"
            data-repo-id="{esc(g.get("repo_id", ""))}"
            data-category="{esc(g.get("category", "Comments"))}"
            data-category-id="{esc(g.get("category_id", ""))}"
            data-mapping="pathname"
            data-strict="0"
            data-reactions-enabled="1"
            data-emit-metadata="0"
            data-input-position="bottom"
            data-theme="dark"
            data-lang="ru"
            crossorigin="anonymous"
            async>
    </script>
</div>
'''
    desc = esc(a.get("summary") or a.get("subtitle") or a["title"])
    layout_style = "" if has_box else ' style="grid-template-columns: 1fr;"'
    sub = f'\n        <p class="article-subtitle">\n            {inline(a["subtitle"])}\n        </p>' if a.get("subtitle") else ""
    return f'''<!DOCTYPE html>
{GEN_MARK}
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>{esc(a["title"])} — MysticRealities Wiki</title>
    <meta name="description" content="{desc}">

    <link rel="icon" type="image/jpeg" href="logo.jpg">
    <link rel="stylesheet" href="../style.css">
    <link rel="stylesheet" href="article.css">
</head>
<body>

<header class="header">
    <a href="../index.html" class="logo">
        MYSTIC<span>REALITIES</span>
        <small>WIKI</small>
    </a>
    <nav>
        <a href="../index.html">Главная сайта</a>
        <a href="../index.html#categories">Категории</a>
        <a href="../index.html#articles">Статьи</a>
        <button id="loginBtn" class="login-btn">Войти</button>
    </nav>
</header>

<main class="article-page">

    <nav class="breadcrumbs">
        <a href="../index.html">Главная Wiki</a>
        <span>/</span>
        <a href="../index.html#categories">{esc(cat["name"])}</a>
        <span>/</span>
        {esc(a["title"])}
    </nav>

    <header class="article-header">
        <div class="eyebrow">{esc(cat["name"].upper())}</div>
        <h1>{esc(a["title"])}</h1>{sub}
    </header>

    <div class="article-layout"{layout_style}>

        <article class="article-body">

{body}

{video_section}

        </article>

{box}
    </div>

</main>
{comments}
<div class="lightbox" id="lightbox">
    <span class="lightbox-close" id="lightboxClose">×</span>
    <img src="" alt="" id="lightboxImg">
</div>

<script src="../script.js"></script>

<script>
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
document.querySelectorAll(".gallery img").forEach(img => {{
    img.addEventListener("click", (event) => {{
        if (img.closest("a[download]")) return;
        lightboxImg.src = img.src;
        lightboxImg.alt = img.alt;
        lightbox.classList.add("open");
    }});
}});
document.getElementById("lightboxClose").addEventListener("click", () => lightbox.classList.remove("open"));
lightbox.addEventListener("click", e => {{ if (e.target === lightbox) lightbox.classList.remove("open"); }});
document.addEventListener("keydown", e => {{ if (e.key === "Escape") lightbox.classList.remove("open"); }});
</script>

</body>
</html>
'''


def listed(model):
    return [a for a in model["articles"] if a.get("published", True)]


def link(a):
    return f"articles/{a['slug']}.html"


def sidebar_html(model):
    out = []
    for c in model["categories"]:
        arts = [a for a in listed(model) if a["category"] == c["id"]]
        links = "\n".join(f'                <a href="{link(a)}" class="sub-link">{esc(a.get("short") or a["title"])}</a>' for a in arts) \
            or "                " + NO_ARTICLES.format(cls="sub-link")
        out.append(f'''        <!-- {esc(c["name"])} -->
        <div class="sidebar-dropdown">
            <div class="side-link dropdown-btn">
                <span>{esc(c["icon"])}</span> {esc(c["name"])} <span class="arrow">▾</span>
            </div>
            <div class="sidebar-submenu">
{links}
            </div>
        </div>
''')
    return "\n".join(out)


def cards_html(model):
    out = []
    for c in model["categories"]:
        arts = [a for a in listed(model) if a["category"] == c["id"]]
        links = "\n".join(f'                        <a href="{link(a)}" class="category-sub-link">{esc(a.get("short") or a["title"])}</a>' for a in arts) \
            or "                        " + NO_ARTICLES.format(cls="category-sub-link")
        out.append(f'''                <div class="category-card category-dropdown">
                    <div class="category-main">
                        <div class="category-icon">{esc(c["icon"])}</div>
                        <span class="category-tag">{esc(c["tag"])}</span>
                        <h3>{esc(c["name"])}</h3>
                        <p>{esc(c["desc"])}</p>
                        <span class="category-arrow">→</span>
                    </div>
                    <div class="category-submenu">
{links}
                    </div>
                </div>
''')
    return "\n".join(out)


def list_html(model):
    cats = {c["id"]: c for c in model["categories"]}
    out = []
    for a in listed(model):
        if not a.get("card", True):
            continue
        pic = (f'<img src="articles/{esc(a["card_image"])}" alt="{esc(a.get("short") or a["title"])}" class="article-symbol-img">'
               if a.get("card_image") else f'<div class="article-symbol">{esc(a.get("card_symbol") or "▤")}</div>')
        out.append(f'''                <a href="{link(a)}" class="article-card" data-title="{esc(a["title"])}">
                    {pic}
                    <div class="article-info">
                        <span>{esc(cats.get(a["category"], {"name": ""})["name"].upper())}</span>
                        <h3>{esc(a.get("short") or a["title"])}</h3>
                        <p>{esc(a.get("summary", ""))}</p>
                    </div>
                    <span class="article-arrow">→</span>
                </a>
''')
    return "\n".join(out)


REGIONS = {
    "SIDEBAR": (sidebar_html, r'(<div class="sidebar-title">РАЗДЕЛЫ</div>\s*)(.*?)(\s*<div class="sidebar-bottom">)'),
    "CATEGORIES": (cards_html, r'(<div class="category-grid">\s*)(.*?)(\s*</div>\s*</section>\s*<section class="section" id="articles">)'),
    "ARTICLES": (list_html, r'(<div class="article-list" id="articleList">\s*)(.*?)(\s*</div>\s*<div class="no-results")'),
}


def read_text(path):
    with open(path, encoding="utf-8", newline="") as f:
        raw = f.read()
    return raw.replace("\r\n", "\n"), ("\r\n" if "\r\n" in raw else "\n")


def write_text(path, text, nl="\n"):
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text.replace("\n", nl))


def region(text, name, inner, fallback):
    start, end = f"<!-- WIKI:{name}:START -->", f"<!-- WIKI:{name}:END -->"
    if start in text and end in text:
        return re.sub(re.escape(start) + r".*?" + re.escape(end), lambda m: f"{start}\n{inner}\n{end}", text, flags=re.S)
    new, n = re.subn(fallback, lambda m: f"{m.group(1)}{start}\n{inner}\n{end}{m.group(3)}", text, count=1, flags=re.S)
    if n != 1:
        raise ValueError(f"В index.html не найден блок «{name}», его нельзя обновить автоматически.")
    return new


def update_index_lists(model):
    """Синхронизирует меню и списки index.html, не пересоздавая другие статьи."""
    text, nl = read_text(INDEX_FILE)
    if not os.path.exists(INDEX_FILE + ".orig"):
        shutil.copyfile(INDEX_FILE, INDEX_FILE + ".orig")
    for name, (fn, fallback) in REGIONS.items():
        text = region(text, name, fn(model), fallback)
    text = re.sub(
        r'(<span class="section-number">)01 / \\d+(</span>)',
        lambda m: f"{m.group(1)}01 / {len(model['categories']):02d}{m.group(2)}",
        text
    )
    write_text(INDEX_FILE, text, nl)


def build_one_article(model, article):
    """Обновляет только HTML-файл одной выбранной статьи. index.html и другие статьи не трогает."""
    cats = {c["id"]: c for c in model["categories"]}
    slug = article.get("slug", "").strip()
    if not slug:
        raise ValueError("У статьи не указан адрес (slug).")
    if article.get("custom"):
        raise ValueError("У этой статьи своя вёрстка — редактор не перезаписывает такие страницы.")
    if not article.get("published", True):
        raise ValueError("Статья является черновиком. Сначала включи публикацию.")
    if article.get("category") not in cats:
        raise ValueError(f"У статьи «{article.get('title', slug)}» не выбрана существующая категория.")

    os.makedirs(ART_DIR, exist_ok=True)
    path = os.path.join(ART_DIR, slug + ".html")
    if os.path.exists(path) and GEN_MARK not in read_text(path)[0] and not os.path.exists(path + ".orig"):
        shutil.copyfile(path, path + ".orig")
    write_text(path, page_html(article, cats[article["category"]], model["settings"]))
    return path


def build(model):
    """Создаёт страницы статей и обновляет списки в index.html. Возвращает отчёт (список строк)."""
    report, cats = [], {c["id"]: c for c in model["categories"]}
    text, nl = read_text(INDEX_FILE)
    if not os.path.exists(INDEX_FILE + ".orig"):
        shutil.copyfile(INDEX_FILE, INDEX_FILE + ".orig")
    for name, (fn, fallback) in REGIONS.items():
        text = region(text, name, fn(model), fallback)
    text = re.sub(r'(<span class="section-number">)01 / \d+(</span>)', lambda m: f"{m.group(1)}01 / {len(model['categories']):02d}{m.group(2)}", text)
    write_text(INDEX_FILE, text, nl)
    report.append("index.html обновлён (меню, категории, список статей)")
    os.makedirs(ART_DIR, exist_ok=True)
    for a in model["articles"]:
        path = os.path.join(ART_DIR, a["slug"] + ".html")
        if a.get("custom"):
            report.append(f"{a['slug']}.html — своя вёрстка, не перезаписан")
            continue
        if not a.get("published", True):
            report.append(f"{a['slug']}.html — черновик, пропущен")
            continue
        if os.path.exists(path) and GEN_MARK not in read_text(path)[0] and not os.path.exists(path + ".orig"):
            shutil.copyfile(path, path + ".orig")
        if a["category"] not in cats:
            raise ValueError(f"У статьи «{a['title']}» не выбрана существующая категория")
        write_text(path, page_html(a, cats[a["category"]], model["settings"]))
        report.append(f"{a['slug']}.html — создан")
    return report


# ======================================================================= импорт существующего сайта
VOID = {"meta", "link", "img", "br", "hr", "input", "source", "area", "base", "col", "embed", "param", "track", "wbr"}


class Node:
    def __init__(self, tag, attrs, parent):
        self.tag, self.attrs, self.parent, self.kids = tag, attrs, parent, []


class Builder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root", {}, None)
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        n = Node(tag, dict(attrs), self.cur)
        self.cur.kids.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        self.cur.kids.append(Node(tag, dict(attrs), self.cur))

    def handle_endtag(self, tag):
        c = self.cur
        while c is not self.root and c.tag != tag:
            c = c.parent
        if c is not self.root:
            self.cur = c.parent

    def handle_data(self, d):
        self.cur.kids.append(d)


def parse_dom(text):
    b = Builder()
    b.feed(text)
    return b.root


def walk(n):
    for k in n.kids:
        if isinstance(k, Node):
            yield k
            yield from walk(k)


def has_cls(n, c):
    return c in (n.attrs.get("class") or "").split()


def find(n, tag=None, cls=None):
    return [x for x in walk(n) if (tag is None or x.tag == tag) and (cls is None or has_cls(x, cls))]


def ser(n):
    if isinstance(n, str):
        return html.escape(n, quote=False)
    attrs = "".join(f' {k}="{html.escape(v or "", quote=True)}"' for k, v in n.attrs.items())
    if n.tag in VOID:
        return f"<{n.tag}{attrs}>"
    return f"<{n.tag}{attrs}>" + "".join(ser(k) for k in n.kids) + f"</{n.tag}>"


def inner(n):
    return clean("".join(ser(k) for k in n.kids))


def plain(n):
    return clean("".join(x if isinstance(x, str) else plain(x) for x in n.kids))


def body_blocks(body):
    blocks, ok = [], True
    for n in body.kids:
        if isinstance(n, str):
            ok = ok and not n.strip()
            continue
        if n.tag in ("h2", "h3", "p", "blockquote"):
            blocks.append({"t": {"blockquote": "quote"}.get(n.tag, n.tag), "text": inner(n)})
        elif n.tag in ("ul", "ol"):
            blocks.append({"t": n.tag, "items": [inner(li) for li in n.kids if isinstance(li, Node) and li.tag == "li"]})
        elif n.tag == "section" and has_cls(n, "media-section"):
            h = find(n, "h2")
            title = plain(h[0]) if h else ""
            figs, vids = find(n, "figure"), find(n, cls="video-item")
            if figs:
                items = []
                for fig in figs:
                    image = (find(fig, "img") or [Node("", {}, None)])[0]
                    anchors = find(fig, "a")
                    download = anchors[0].attrs.get("href", "") if anchors and "download" in anchors[0].attrs else ""
                    caption = plain(c[0]) if (c := find(fig, "figcaption")) else ""
                    items.append([image.attrs.get("src", ""), caption, download])
                blocks.append({"t": "gallery", "title": title if title != "Фотогалерея" else "", "items": items})
            if vids:
                items = []
                for v in vids:
                    m = (find(v, "iframe") or find(v, "video") or [None])[0]
                    c = find(v, cls="video-caption")
                    items.append([m.attrs.get("src", "") if m else "", plain(c[0]) if c else ""])
                blocks.append({"t": "video", "title": title if title != "Видео" else "", "items": items})
        else:
            ok = False
    return blocks, ok


def parse_article(text):
    """Возвращает (поля статьи, распознана_ли_вёрстка)."""
    dom = parse_dom(text)
    body, h1 = (find(dom, "article", "article-body") or [None])[0], (find(dom, "h1") or [None])[0]
    if not body or not h1:
        return {}, False, None
    a = {"title": plain(h1)}
    sub = find(dom, "p", "article-subtitle")
    a["subtitle"] = inner(sub[0]) if sub else ""
    a["blocks"], ok = body_blocks(body)
    box = find(dom, "aside", "infobox")
    if box:
        t = find(box[0], cls="infobox-title")
        im = find(box[0], "img")
        a["infobox_title"] = plain(t[0]) if t else "КАРТОЧКА"
        a["infobox_image"] = im[0].attrs.get("src", "") if im else ""
        a["infobox"] = [[plain(tr_th[0]), inner(tr_td[0])] for tr in find(box[0], "tr")
                        if (tr_th := find(tr, "th")) and (tr_td := find(tr, "td"))]
    a["comments"] = any("giscus.app/client.js" in (s.attrs.get("src") or "") for s in find(dom, "script"))
    g = next((s.attrs for s in find(dom, "script") if "giscus.app/client.js" in (s.attrs.get("src") or "")), None)
    return a, ok, g


def import_site():
    dom = parse_dom(read_text(INDEX_FILE)[0])
    model = {"settings": {"giscus": {}, "comments_default": True}, "categories": [], "articles": []}
    cards = {c.attrs.get("href"): c for c in find(dom, "a", "article-card")}
    seen = {}
    for card in find(dom, "div", "category-card"):
        tag = plain((find(card, cls="category-tag") or [Node("", {}, None)])[0]) or "SECTION"
        cid = re.sub(r"[^a-z0-9]+", "-", tag.lower()).strip("-") or f"cat{len(model['categories']) + 1}"
        model["categories"].append({
            "id": cid, "name": plain(find(card, "h3")[0]), "icon": plain((find(card, cls="category-icon") or [Node("", {}, None)])[0]) or "◈",
            "tag": tag, "desc": plain(find(card, "p")[0]) if find(card, "p") else ""})
        for a in find(card, "a", "category-sub-link"):
            href = a.attrs.get("href", "")
            if href.startswith("articles/") and href.endswith(".html") and href not in seen:
                seen[href] = (cid, plain(a))
    for href, (cid, label) in seen.items():
        slug = os.path.basename(href)[:-5]
        art = {"slug": slug, "title": label, "short": label, "category": cid, "subtitle": "", "summary": "", "card": href in cards,
               "card_image": "", "card_symbol": "▤", "published": True, "comments": True, "custom": False,
               "infobox_title": "КАРТОЧКА", "infobox_image": "", "infobox": [], "blocks": []}
        card = cards.get(href)
        if card:
            art["title"] = card.attrs.get("data-title") or label
            art["short"] = plain(find(card, "h3")[0])
            art["summary"] = plain(find(card, "p")[0]) if find(card, "p") else ""
            img, sym = find(card, "img"), find(card, cls="article-symbol")
            if img:
                src = img[0].attrs.get("src", "")
                art["card_image"] = src[len("articles/"):] if src.startswith("articles/") else src
            if sym:
                art["card_symbol"] = plain(sym[0])
        path = os.path.join(ART_DIR, slug + ".html")
        if os.path.exists(path):
            text = read_text(path)[0]
            fields, ok, g = parse_article(text)
            if fields:
                art.update(fields)
                art["custom"] = not ok
                if g and not model["settings"]["giscus"]:
                    model["settings"]["giscus"] = {"repo": g.get("data-repo", ""), "repo_id": g.get("data-repo-id", ""),
                                                   "category": g.get("data-category", "Comments"), "category_id": g.get("data-category-id", "")}
            else:
                art["custom"] = True
        model["articles"].append(art)
    return model


# ======================================================================= интерфейс
def same_file(a, b):
    try:
        return os.path.samefile(a, b)
    except OSError:
        return False


def pick_image(var):
    path = filedialog.askopenfilename(title="Выбери картинку",
                                      filetypes=[("Картинки", "*.png *.jpg *.jpeg *.webp *.gif"), ("Все файлы", "*.*")])
    if not path:
        return
    os.makedirs(MEDIA_DIR, exist_ok=True)
    base, ext = os.path.splitext(os.path.basename(path))
    dest, n = os.path.join(MEDIA_DIR, base + ext), 2
    while os.path.exists(dest) and not same_file(path, dest):
        dest = os.path.join(MEDIA_DIR, f"{base}_{n}{ext}")
        n += 1
    if not os.path.exists(dest):
        shutil.copyfile(path, dest)
    var.set("media/" + os.path.basename(dest))


APP = None


class Form:
    def __init__(self, parent, fields):
        self.fields, self.vars, self.combos = fields, {}, {}
        for r, (key, label, typ, *opt) in enumerate(fields):
            ttk.Label(parent, text=label).grid(row=r, column=0, sticky="w", padx=6, pady=3)
            if typ == "bool":
                v = tk.BooleanVar()
                ttk.Checkbutton(parent, variable=v).grid(row=r, column=1, sticky="w")
            elif typ == "choice":
                v = tk.StringVar()
                cb = ttk.Combobox(parent, textvariable=v, state="readonly", width=40)
                cb.grid(row=r, column=1, sticky="w")
                self.combos[key] = (cb, opt[0])
            elif typ == "image":
                v = tk.StringVar()
                fr = ttk.Frame(parent)
                fr.grid(row=r, column=1, sticky="w")
                ttk.Entry(fr, textvariable=v, width=40).pack(side="left")
                ttk.Button(fr, text="Выбрать…", command=lambda v=v: pick_image(v)).pack(side="left", padx=4)
                ttk.Button(fr, text="✕", width=3, command=lambda v=v: v.set("")).pack(side="left")
            else:
                v = tk.StringVar()
                ttk.Entry(parent, textvariable=v, width=60).grid(row=r, column=1, sticky="w")
            self.vars[key] = v

    def set(self, item):
        for key, label, typ, *opt in self.fields:
            if key in self.combos:
                cb, opts = self.combos[key]
                cb["values"] = opts() if callable(opts) else opts
            v = item.get(key)
            self.vars[key].set(bool(v) if typ == "bool" else ("" if v is None else str(v)))

    def get(self):
        out = {}
        for key, label, typ, *opt in self.fields:
            raw = self.vars[key].get()
            if typ == "bool":
                out[key] = bool(raw)
                continue
            raw = raw.strip()
            if typ == "choice" and not raw:
                raise ValueError(f"Поле «{label}»: выбери значение")
            if typ == "str" and not raw and key in ("id", "slug", "title", "name"):
                raise ValueError(f"Поле «{label}» не может быть пустым")
            if key == "slug" and not re.fullmatch(r"[a-z0-9_-]+", raw):
                raise ValueError("Имя файла (slug): только латинские буквы, цифры, «_» и «-», без пробелов")
            out[key] = raw
        return out


def scrollable(parent):
    canvas = tk.Canvas(parent, highlightthickness=0)
    bar = ttk.Scrollbar(parent, orient="vertical", command=canvas.yview)
    inner_fr = ttk.Frame(canvas)
    inner_fr.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
    canvas.create_window((0, 0), window=inner_fr, anchor="nw")
    canvas.configure(yscrollcommand=bar.set)
    canvas.pack(side="left", fill="both", expand=True)
    bar.pack(side="right", fill="y")
    return inner_fr


class ArticleExtra:
    """Инфобокс (строки «Название | Значение») и текст статьи с панелью кнопок."""
    keys = ("infobox", "blocks", "video_items")

    def __init__(self, parent):
        box = ttk.LabelFrame(parent, text="Карточка справа: по строке «Название | Значение»")
        box.pack(anchor="nw", fill="x", padx=6, pady=6)
        self.info = tk.Text(box, width=100, height=7, wrap="word")
        self.info.pack(padx=4, pady=4)
        txt = ttk.LabelFrame(parent, text="Текст статьи")
        txt.pack(anchor="nw", fill="both", padx=6, pady=6)
        bar = ttk.Frame(txt)
        bar.pack(fill="x", padx=4, pady=2)
        for label, cmd in (("Ж", lambda: self.wrap("**", "**")), ("Ссылка", self.add_link), ("## Раздел", lambda: self.line("## ")),
                           ("### Подраздел", lambda: self.line("### ")), ("• Список", lambda: self.line("- ")),
                           ("❝ Цитата", lambda: self.line("> ")), ("＋ Фото", self.add_photo), ("＋ Видео", self.add_video)):
            ttk.Button(bar, text=label, command=cmd).pack(side="left", padx=2)
        self.body = tk.Text(txt, width=100, height=26, wrap="word", undo=True)
        self.body.pack(padx=4, pady=4)
        vids = ttk.LabelFrame(parent, text="Видеоматериалы — отдельные карточки для страницы-каталога")
        vids.pack(anchor="nw", fill="x", padx=6, pady=6)
        self.video_list = tk.Listbox(vids, width=100, height=5, exportselection=False)
        self.video_list.pack(fill="x", padx=4, pady=4)
        vbar = ttk.Frame(vids)
        vbar.pack(anchor="w", padx=4, pady=3)
        ttk.Button(vbar, text="＋ Добавить видео", command=self.add_video_card).pack(side="left", padx=2)
        ttk.Button(vbar, text="Изменить", command=self.edit_video_card).pack(side="left", padx=2)
        ttk.Button(vbar, text="Удалить", command=self.delete_video_card).pack(side="left", padx=2)
        self.video_items = []

    def set(self, item):
        self.info.delete("1.0", "end")
        self.info.insert("end", "\n".join(f"{k} | {v}" for k, v in item.get("infobox", [])))
        self.body.delete("1.0", "end")
        self.body.insert("end", blocks_to_text(item.get("blocks", [])))
        self.video_items = copy.deepcopy(item.get("video_items", []))
        self.refresh_video_list()

    def refresh_video_list(self, select=None):
        self.video_list.delete(0, "end")
        for v in self.video_items:
            self.video_list.insert("end", f"{v.get('title', 'Видео')}  |  {v.get('date', '')}  |  {v.get('src', '')}")
        if self.video_items:
            idx = len(self.video_items) - 1 if select is None else max(0, min(select, len(self.video_items)-1))
            self.video_list.selection_set(idx)

    def add_video_card(self):
        title = simpledialog.askstring("Новое видео", "Название видеокарточки:", parent=self.body.winfo_toplevel())
        if not title:
            return
        date = simpledialog.askstring("Дата", "Дата (например: 20 ноября 2024г):", parent=self.body.winfo_toplevel()) or ""
        path = filedialog.askopenfilename(parent=self.body.winfo_toplevel(), title="Выбери видеофайл", filetypes=[("Видео", "*.mp4 *.webm *.ogg"), ("Все файлы", "*.*")])
        if path:
            os.makedirs(os.path.join(MEDIA_DIR, "video"), exist_ok=True)
            filename = os.path.basename(path)
            dest = os.path.join(MEDIA_DIR, "video", filename)
            if os.path.abspath(path) != os.path.abspath(dest):
                base, ext = os.path.splitext(filename)
                n = 2
                while os.path.exists(dest):
                    filename = f"{base}_{n}{ext}"
                    dest = os.path.join(MEDIA_DIR, "video", filename)
                    n += 1
                shutil.copy2(path, dest)
            src = f"media/video/{filename}"
        else:
            src = simpledialog.askstring("Ссылка на видео", "Вставь URL видео (YouTube или прямая ссылка):", parent=self.body.winfo_toplevel())
            if not src:
                return
        self.video_items.append({"title": title.strip(), "src": src.strip(), "date": date.strip()})
        self.refresh_video_list()

    def edit_video_card(self):
        sel = self.video_list.curselection()
        if not sel:
            return
        i = sel[0]
        old = self.video_items[i]
        title = simpledialog.askstring("Название", "Название:", initialvalue=old.get("title", ""), parent=self.body.winfo_toplevel())
        if title is None:
            return
        src = simpledialog.askstring("Файл или ссылка", "Путь (например media/video/clip.mp4) или URL:", initialvalue=old.get("src", ""), parent=self.body.winfo_toplevel())
        if src is None:
            return
        date = simpledialog.askstring("Дата", "Дата:", initialvalue=old.get("date", ""), parent=self.body.winfo_toplevel())
        if date is None:
            return
        self.video_items[i] = {"title": title.strip(), "src": src.strip(), "date": date.strip()}
        self.refresh_video_list(i)

    def delete_video_card(self):
        sel = self.video_list.curselection()
        if not sel:
            return
        i = sel[0]
        if messagebox.askyesno("Удалить видео", f"Удалить карточку «{self.video_items[i].get('title', 'Видео')}»?", parent=self.body.winfo_toplevel()):
            del self.video_items[i]
            self.refresh_video_list()

    def get(self):
        rows = []
        for ln in self.info.get("1.0", "end").splitlines():
            if ln.strip():
                if "|" not in ln:
                    raise ValueError(f"В карточке нет « | » в строке: {ln[:60]}")
                k, _, v = ln.partition("|")
                rows.append([k.strip(), v.strip()])
        return {"infobox": rows, "blocks": text_to_blocks(self.body.get("1.0", "end")), "video_items": copy.deepcopy(self.video_items)}

    # --- кнопки панели
    def wrap(self, a, b):
        try:
            s, e = self.body.index("sel.first"), self.body.index("sel.last")
            self.body.insert(e, b)
            self.body.insert(s, a)
        except tk.TclError:
            self.body.insert("insert", a + "текст" + b)

    def line(self, prefix):
        self.body.insert("insert linestart", prefix)

    def add_link(self):
        url = simpledialog.askstring("Ссылка", "Адрес (https://…):")
        if url:
            self.wrap("[", f"]({url})")

    def add_photo(self):
        preview = tk.StringVar()
        pick_image(preview)
        if not preview.get():
            return
        caption = simpledialog.askstring("Подпись", "Подпись под изображением (можно оставить пустой):",
                                         parent=self.body.winfo_toplevel()) or ""
        download = ""
        if messagebox.askyesno("Изображение для скачивания",
                               "При нажатии на превью посетитель должен скачивать ДРУГОЕ изображение?",
                               parent=self.body.winfo_toplevel()):
            download_var = tk.StringVar()
            pick_image(download_var)
            download = download_var.get()
            if not download:
                return
        line = f"[[gallery: {preview.get()} | {caption}"
        if download:
            line += f" | {download}"
        line += "]]"
        self.body.insert("insert", f"\n\n{line}\n\n")

    def add_video(self):
        url = simpledialog.askstring("Видео", "Ссылка на YouTube или файл .mp4:")
        if url:
            self.body.insert("insert", f"\n\n[[video: {url} | подпись]]\n\n")


class Tab(ttk.Frame):
    def __init__(self, nb, key, fields, new_item, label, idf="id", extra=None):
        super().__init__(nb)
        self.key, self.new_item, self.label, self.idf, self.cur = key, new_item, label, idf, None
        left = ttk.Frame(self)
        left.pack(side="left", fill="y", padx=6, pady=6)
        self.lb = tk.Listbox(left, width=34, height=28, exportselection=False)
        self.lb.pack(fill="y", expand=True)
        self.lb.bind("<<ListboxSelect>>", self.on_select)
        bar = ttk.Frame(left)
        bar.pack(fill="x", pady=4)
        for text, cmd in (("＋ Новая", self.add), ("Копия", self.dup), ("Удалить", self.delete),
                          ("↑", lambda: self.move(-1)), ("↓", lambda: self.move(1))):
            ttk.Button(bar, text=text, width=8 if len(text) > 2 else 3, command=cmd).pack(side="left", padx=1)
        right = ttk.Frame(self)
        right.pack(side="left", fill="both", expand=True, padx=6, pady=6)
        inner_fr = scrollable(right)
        form_fr = ttk.Frame(inner_fr)
        form_fr.pack(anchor="nw")
        self.form = Form(form_fr, fields)
        self.extra = extra(inner_fr) if extra else None
        ttk.Button(inner_fr, text="✔ Применить изменения", command=self.apply).pack(anchor="nw", padx=6, pady=8)

    def items(self):
        return APP.model[self.key]

    def unique(self, base):
        value, n = base, 2
        while any(x.get(self.idf) == value for x in self.items()):
            value, n = f"{base}_{n}", n + 1
        return value

    def refresh(self, select=0):
        self.lb.delete(0, "end")
        for it in self.items():
            self.lb.insert("end", self.label(it))
        if self.items():
            self.cur = max(0, min(select, len(self.items()) - 1))
            self.lb.selection_set(self.cur)
            self.load(self.cur)
        else:
            self.cur = None

    def load(self, i):
        self.form.set(self.items()[i])
        if self.extra:
            self.extra.set(self.items()[i])

    def apply(self):
        if self.cur is None:
            return True
        try:
            data = self.form.get()
            if self.extra:
                data.update(self.extra.get())
        except ValueError as e:
            messagebox.showerror("Ошибка в поле", str(e))
            return False
        old = self.items()[self.cur]
        if any(x is not old and x.get(self.idf) == data.get(self.idf) for x in self.items()):
            messagebox.showerror("Ошибка", f"«{data.get(self.idf)}» уже занят — значение должно быть уникальным.")
            return False
        managed = [f[0] for f in self.form.fields] + (list(self.extra.keys) if self.extra else [])
        keep = {k: v for k, v in old.items() if k not in managed}
        old.clear()
        old.update(data)
        old.update(keep)
        self.lb.delete(self.cur)
        self.lb.insert(self.cur, self.label(old))
        self.lb.selection_clear(0, "end")
        self.lb.selection_set(self.cur)
        return True

    def on_select(self, _):
        sel = self.lb.curselection()
        if not sel or sel[0] == self.cur:
            return
        new = sel[0]
        if not self.apply():
            self.lb.selection_clear(0, "end")
            self.lb.selection_set(self.cur)
            return
        self.lb.selection_clear(0, "end")
        self.lb.selection_set(new)
        self.cur = new
        self.load(new)

    def add(self):
        if not self.apply():
            return
        it = copy.deepcopy(self.new_item)
        it[self.idf] = self.unique(it[self.idf])
        if self.key == "articles" and APP.model["categories"]:
            it["category"] = APP.model["categories"][0]["id"]
        self.items().append(it)
        self.refresh(len(self.items()) - 1)

    def dup(self):
        if self.cur is None or not self.apply():
            return
        it = copy.deepcopy(self.items()[self.cur])
        it[self.idf] = self.unique(it[self.idf] + "_copy")
        it["custom"] = False
        self.items().append(it)
        self.refresh(len(self.items()) - 1)

    def delete(self):
        if self.cur is None:
            return
        if messagebox.askyesno("Удалить", f"Удалить «{self.label(self.items()[self.cur])}»?\n(Готовый файл страницы останется на диске.)"):
            del self.items()[self.cur]
            self.refresh(self.cur - 1)

    def move(self, d):
        if self.cur is None or not self.apply():
            return
        j = self.cur + d
        if 0 <= j < len(self.items()):
            lst = self.items()
            lst[self.cur], lst[j] = lst[j], lst[self.cur]
            self.refresh(j)


class Settings(ttk.Frame):
    FIELDS = [("repo", "Комментарии giscus: репозиторий (имя/репо)", "str"), ("repo_id", "repo-id", "str"),
              ("category", "Категория обсуждений", "str"), ("category_id", "category-id", "str")]

    def __init__(self, nb):
        super().__init__(nb)
        fr = ttk.Frame(self)
        fr.pack(anchor="nw", padx=10, pady=10)
        self.form = Form(fr, self.FIELDS)
        ttk.Label(self, text="Эти данные нужны для блока комментариев на страницах статей (giscus).", foreground="#888").pack(anchor="nw", padx=10)

    def refresh(self, **_):
        self.form.set(APP.model["settings"].get("giscus", {}))

    def apply(self):
        APP.model["settings"]["giscus"] = {k: v.get().strip() for k, v in self.form.vars.items()}
        return True


def problems(m):
    out, cats = [], {c["id"] for c in m["categories"]}
    slugs = [a["slug"] for a in m["articles"]]
    out += [f"Повторяется имя файла: {s}" for s in set(slugs) if slugs.count(s) > 1]
    for a in m["articles"]:
        if a["category"] not in cats:
            out.append(f"Статья «{a['title']}»: нет категории «{a['category']}»")
        if a.get("published", True) and not a.get("custom") and not a.get("blocks"):
            out.append(f"Статья «{a['title']}» пока пустая")
    if not m["settings"].get("giscus", {}).get("repo"):
        out.append("Не заполнены данные giscus — комментарии на страницах не появятся")
    return out


CAT_FIELDS = [("id", "ID (латиницей, уникальный)", "str"), ("name", "Название", "str"), ("icon", "Значок (один символ)", "str"),
              ("tag", "Метка (например GAME WORLD)", "str"), ("desc", "Описание на карточке", "str")]


def art_fields():
    return [("slug", "Имя файла (slug, латиницей)", "str"), ("title", "Заголовок статьи", "str"),
            ("short", "Короткое название (для меню и карточки)", "str"),
            ("category", "Категория", "choice", lambda: [c["id"] for c in APP.model["categories"]]),
            ("subtitle", "Подзаголовок", "str"), ("summary", "Описание на карточке в списке", "str"),
            ("published", "Опубликована (показывать на сайте)", "bool"), ("card", "Показывать карточку в списке статей", "bool"),
            ("card_symbol", "Символ вместо картинки на карточке", "str"), ("card_image", "Картинка на карточке", "image"),
            ("comments", "Комментарии под статьёй", "bool"),
            ("custom", "Своя вёрстка (редактор не перезаписывает файл)", "bool"),
            ("infobox_title", "Заголовок карточки справа", "str"), ("infobox_image", "Картинка в карточке справа", "image")]


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        global APP
        APP = self
        self.title("Редактор вики — MysticRealities")
        self.geometry("1240x860")
        self.tabs = []
        if os.path.exists(DATA_FILE):
            self.model = json.load(open(DATA_FILE, encoding="utf-8"))
        elif os.path.exists(INDEX_FILE):
            self.model = {"settings": {"giscus": {}}, "categories": [], "articles": []}
            if messagebox.askyesno("Первый запуск", "Файла wiki-content.json ещё нет.\nПрочитать текущий сайт (index.html и статьи)?"):
                self.do_import(ask=False)
        else:
            messagebox.showerror("Не та папка", "Положи редактор в корень вики — рядом с index.html.")
            sys.exit(1)
        top = ttk.Frame(self)
        top.pack(fill="x", padx=8, pady=6)
        for text, cmd in (("💾 Сохранить", self.save), ("📝 Обновить выбранную статью", self.build_selected),
                          ("🛠 Собрать весь сайт", self.build), ("🌐 Открыть сайт", self.open_site),
                          ("Проверить", self.check), ("📥 Импорт с сайта", self.do_import)):
            ttk.Button(top, text=text, command=cmd).pack(side="left", padx=3)
        self.nb = ttk.Notebook(self)
        self.nb.pack(fill="both", expand=True, padx=8, pady=4)
        self.tabs = [
            ("Статьи", Tab(self.nb, "articles", art_fields(), {
                "slug": "new_article", "title": "Новая статья", "short": "", "category": "", "subtitle": "", "summary": "",
                "published": False, "card": True, "card_symbol": "▤", "card_image": "", "comments": True,
                "infobox_title": "КАРТОЧКА", "infobox_image": "", "infobox": [], "blocks": [{"t": "h2", "text": "Общая информация"}, {"t": "p", "text": "Текст статьи."}]},
                lambda a: f"{'' if a.get('published', True) else '✎ '}{a.get('title', '')}  ({a.get('slug', '')}){'  [своя вёрстка]' if a.get('custom') else ''}",
                idf="slug", extra=ArticleExtra)),
            ("Категории", Tab(self.nb, "categories", CAT_FIELDS, {
                "id": "new_category", "name": "Новая категория", "icon": "◈", "tag": "NEW", "desc": ""},
                lambda c: f"{c['icon']} {c['name']}  ({c['id']})")),
            ("Настройки", Settings(self.nb)),
        ]
        for title, tab in self.tabs:
            self.nb.add(tab, text=title)
            tab.refresh()
        self.bind("<Control-s>", lambda e: self.save())

    def apply_all(self):
        for _, tab in self.tabs:
            if not tab.apply():
                self.nb.select(tab)
                return False
        return True

    def save(self, quiet=False):
        if not self.apply_all():
            return False
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(self.model, f, ensure_ascii=False, indent=2)
        if not quiet:
            messagebox.showinfo("Сохранено", "Изменения записаны в wiki-content.json.\nЧтобы они появились на сайте, нажми «Собрать сайт».")
        return True

    def check(self):
        if self.apply_all():
            p = problems(self.model)
            messagebox.showinfo("Проверка", "Замечаний нет ✔" if not p else "Найдено:\n\n• " + "\n• ".join(p))

    def build_selected(self):
        articles_tab = self.tabs[0][1]
        if self.nb.index(self.nb.select()) != 0:
            self.nb.select(articles_tab)
        if articles_tab.cur is None:
            messagebox.showwarning("Нет выбранной статьи", "Сначала выбери статью во вкладке «Статьи».")
            return
        if not self.save(quiet=True):
            return
        # После сохранения берём актуальную статью по текущему индексу.
        article = self.model["articles"][articles_tab.cur]
        try:
            path = build_one_article(self.model, article)
            # Автоматически добавляем/обновляем ссылку на статью в меню,
            # карточках категорий и общем списке на главной Wiki.
            update_index_lists(self.model)
        except Exception as e:
            messagebox.showerror("Не удалось обновить статью", str(e))
            return
        messagebox.showinfo(
            "Статья обновлена",
            f"Обновлён только файл: articles/{article['slug']}.html\\n"
            "Ссылки на неё также автоматически обновлены на главной странице Wiki.\\n"
            "Остальные статьи не изменялись.\\n\\n"
            "Обнови страницу в браузере (Ctrl+F5)."
        )

    def build(self):
        if not self.save(quiet=True):
            return
        p = problems(self.model)
        if p and not messagebox.askyesno("Есть замечания", "Найдено:\n\n• " + "\n• ".join(p) + "\n\nВсё равно собрать сайт?"):
            return
        try:
            report = build(self.model)
        except Exception as e:
            messagebox.showerror("Не удалось собрать сайт", str(e))
            return
        messagebox.showinfo("Сайт собран", "\n".join(report) + "\n\nОбнови страницу в браузере (Ctrl+F5).")

    def open_site(self):
        target = INDEX_FILE
        cur = self.tabs[0][1].cur
        if self.nb.index(self.nb.select()) == 0 and cur is not None:
            page = os.path.join(ART_DIR, self.model["articles"][cur]["slug"] + ".html")
            if os.path.exists(page):
                target = page
        webbrowser.open(pathlib.Path(target).as_uri())

    def do_import(self, ask=True):
        if ask and not messagebox.askyesno("Импорт", "Прочитать текущий сайт заново?\nТо, что сейчас в редакторе, будет заменено."):
            return
        try:
            self.model = import_site()
        except Exception as e:
            messagebox.showerror("Импорт не удался", str(e))
            return
        custom = [a["slug"] for a in self.model["articles"] if a.get("custom")]
        for _, tab in self.tabs:
            tab.refresh()
        messagebox.showinfo("Импорт", f"Категорий: {len(self.model['categories'])}, статей: {len(self.model['articles'])}."
                            + (f"\n\nСвоя вёрстка (редактор их не перезаписывает): {', '.join(custom)}" if custom else ""))


if __name__ == "__main__":
    App().mainloop()
