#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Редактор контента гачи MysticRealities.

Запуск:  python gacha-editor.py     (положи файл рядом с gacha-content.js, ничего устанавливать не нужно —
         нужен только Python с Tkinter, он есть в обычной установке Python для Windows).

Что умеет: агенты, W-двигатели, диски, комплекты, баннеры, товары магазина, Отголоски, уровни Разума.
Картинки копируются в  assets/gacha/  (две папки выше папки гачи), а в файл пишется готовый путь.
Перед каждым сохранением рядом кладётся резервная копия gacha-content.js.bak.
"""
import copy
import json
import os
import re
import shutil
import sys
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

HERE = os.path.dirname(os.path.abspath(__file__))
CONTENT_FILE = os.path.join(HERE, "gacha-content.js")
ASSETS_DIR = os.path.normpath(os.path.join(HERE, "..", "..", "assets", "gacha"))
ASSETS_URL = "../../assets/gacha/"          # путь к картинкам от файла gacha.html
HEADER = ("// Файл создан редактором gacha-editor.py. Можно править и руками, "
          "но внутри CONTENT должен остаться корректный JSON.\n")

STATS = ["atk", "hp", "def", "cr", "cd", "atk%", "hp%", "def%"]
RANKS = ["S", "A", "B"]
CURRENCIES = ["money", "echo", "master", "encrypted"]
OMIT = object()                              # пустое необязательное поле — ключ не пишется


# ---------------------------------------------------------------- данные
def load():
    text = open(CONTENT_FILE, encoding="utf-8").read()
    m = re.search(r"const CONTENT\s*=\s*(\{.*\})\s*;?\s*$", text, re.S)
    if not m:
        raise ValueError("В gacha-content.js не найден блок const CONTENT = { ... };")
    raw = json.loads(m.group(1))
    model = {k: raw.get(k, []) for k in ("agents", "weapons", "discs", "banners")}
    model["sets"] = [dict(key=k, **v) for k, v in raw.get("sets", {}).items()]
    model["shop_tabs"] = [{"id": t["id"], "name": t["name"], "currency": t["currency"]} for t in raw.get("shop", [])]
    model["shop_items"] = [dict(it, tab=t["id"]) for t in raw.get("shop", []) for it in t["items"]]
    model["echoes"] = raw.get("echoes", {"S": 40, "A": 20, "B": 8})
    model["minds"] = raw.get("minds", [])
    return model


def dump(model):
    raw = {k: model[k] for k in ("agents", "weapons", "discs", "banners")}
    raw["sets"] = {s["key"]: {k: v for k, v in s.items() if k != "key"} for s in model["sets"]}
    raw["shop"] = [dict(t, items=[{k: v for k, v in it.items() if k != "tab"}
                                  for it in model["shop_items"] if it["tab"] == t["id"]])
                   for t in model["shop_tabs"]]
    raw["echoes"] = model["echoes"]
    raw["minds"] = model["minds"]
    return raw


def write(model):
    if os.path.exists(CONTENT_FILE):
        shutil.copyfile(CONTENT_FILE, CONTENT_FILE + ".bak")
    body = json.dumps(dump(model), ensure_ascii=False, indent=2)
    with open(CONTENT_FILE, "w", encoding="utf-8") as f:
        f.write(HEADER + "const CONTENT = " + body + ";\n")


def problems(m):
    """Список ошибок и предупреждений по содержимому."""
    out, ids = [], {}
    for k in ("agents", "weapons", "discs"):
        for it in m[k]:
            if not it.get("id"):
                out.append(f"Пустой ID в разделе «{k}»")
            if it.get("id") in ids:
                out.append(f"Повторяется ID: {it['id']}")
            ids[it.get("id")] = k
    set_keys = {s["key"] for s in m["sets"]}
    for d in m["discs"]:
        if d.get("set") not in set_keys:
            out.append(f"Диск «{d['id']}»: нет комплекта «{d.get('set')}»")

    def has(t, rank, limited):
        return any(x["rarity"] == rank and (limited is None or bool(x.get("limited")) == limited) for x in m[t])

    for b in m["banners"]:
        need = ([("weapons", "S", False), ("weapons", "A", None), ("weapons", "B", None)] if b["rule"] == "weapon"
                else [("agents", "S", False), ("agents", "A", None), ("discs", "B", None)])
        for t, rank, lim in need:
            if not has(t, rank, lim):
                out.append(f"Баннер «{b['id']}»: в пуле нет предметов ({t}, ранг {rank}"
                           f"{', не лимитированных' if lim is False else ''})")
        for f in ("featS", "featA"):
            for i in b.get(f, []):
                if i not in ids:
                    out.append(f"Баннер «{b['id']}»: предмета «{i}» не существует")
    tabs = {t["id"] for t in m["shop_tabs"]}
    for it in m["shop_items"]:
        if it["tab"] not in tabs:
            out.append(f"Товар «{it['key']}»: нет вкладки «{it['tab']}»")
        if "item" in it["give"] and it["give"]["item"] not in ids:
            out.append(f"Товар «{it['key']}»: предмета «{it['give']['item']}» не существует")
    keys = [it["key"] for it in m["shop_items"]]
    out += [f"Повторяется ключ товара: {k}" for k in set(keys) if keys.count(k) > 1]
    if len(m["minds"]) != 6:
        out.append("Общий список Разума должен содержать ровно 6 уровней")
    return out


# ---------------------------------------------------------------- разбор полей
def num(text):
    x = float(text.replace(",", "."))
    return int(x) if x == int(x) else x


def fmt(v, typ):
    if v is None or v is OMIT:
        return ""
    if typ == "pair":
        return f"{v[0]}:{v[1]}" if v else ""
    if typ == "list":
        return ", ".join(v)
    if typ == "give":
        k, val = next(iter(v.items()))
        return f"{k}:{val}"
    return str(v)


def parse(text, typ, label):
    text = text.strip()
    try:
        if typ == "int":
            return int(num(text or "0"))
        if typ == "float":
            return float(num(text or "0"))
        if typ == "optint":
            return None if not text else int(num(text))
        if typ == "optstr":
            return text if text else OMIT
        if typ == "pair":
            stat, val = text.split(":")
            if stat.strip() not in STATS:
                raise ValueError(f"стат «{stat}» неизвестен, можно: {', '.join(STATS)}")
            return [stat.strip(), num(val)]
        if typ == "list":
            return [x.strip() for x in text.split(",") if x.strip()]
        if typ == "give":
            kind, val = [x.strip() for x in text.split(":")]
            if kind in ("master", "encrypted"):
                return {kind: int(num(val))}
            if kind == "item":
                return {"item": val}
            raise ValueError("начни с master:, encrypted: или item:")
        return text
    except ValueError as e:
        raise ValueError(f"Поле «{label}»: неверное значение «{text}» ({e})")


HINTS = {"pair": "стат:число, например cd:48", "list": "id через запятую", "optint": "пусто — без лимита",
         "optstr": "можно оставить пустым", "give": "master:1  |  encrypted:1  |  item:id_предмета"}

APP = None  # главное окно (нужно для списков выбора)


# ---------------------------------------------------------------- формы
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
                cb = ttk.Combobox(parent, textvariable=v, state="readonly", width=34)
                cb.grid(row=r, column=1, sticky="w")
                self.combos[key] = (cb, opt[0])
            elif typ == "image":
                v = tk.StringVar()
                fr = ttk.Frame(parent)
                fr.grid(row=r, column=1, sticky="w")
                ttk.Entry(fr, textvariable=v, width=38).pack(side="left")
                ttk.Button(fr, text="Выбрать…", command=lambda v=v: pick_image(v)).pack(side="left", padx=4)
                ttk.Button(fr, text="✕", width=3, command=lambda v=v: v.set("")).pack(side="left")
            else:
                v = tk.StringVar()
                ttk.Entry(parent, textvariable=v, width=44).grid(row=r, column=1, sticky="w")
                if typ in HINTS:
                    ttk.Label(parent, text=HINTS[typ], foreground="#888").grid(row=r, column=2, sticky="w", padx=6)
            self.vars[key] = v

    def set(self, item):
        for key, label, typ, *opt in self.fields:
            if key in self.combos:
                cb, opts = self.combos[key]
                cb["values"] = opts() if callable(opts) else opts
            v = item.get(key)
            if typ == "bool":
                self.vars[key].set(bool(v))
            else:
                self.vars[key].set(fmt(v, typ))

    def get(self):
        out = {}
        for key, label, typ, *opt in self.fields:
            raw = self.vars[key].get()
            if typ == "bool":
                out[key] = bool(raw)
                continue
            if typ == "choice" and not raw:
                raise ValueError(f"Поле «{label}»: выбери значение")
            val = parse(raw, typ, label)
            if typ in ("str",) and not val and key in ("id", "key", "name"):
                raise ValueError(f"Поле «{label}» не может быть пустым")
            if val is not OMIT:
                out[key] = val
        return out


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
    os.makedirs(ASSETS_DIR, exist_ok=True)
    name = os.path.basename(path)
    base, ext = os.path.splitext(name)
    dest, n = os.path.join(ASSETS_DIR, name), 2
    while os.path.exists(dest) and not same_file(path, dest):   # такое имя уже занято другой картинкой
        dest = os.path.join(ASSETS_DIR, f"{base}_{n}{ext}")
        n += 1
    if not os.path.exists(dest):
        shutil.copyfile(path, dest)
    var.set(ASSETS_URL + os.path.basename(dest))


class MindsEditor(ttk.LabelFrame):
    """6 уровней Разума: название, описание, эффекты, «+2 к навыкам»."""
    def __init__(self, parent, title):
        super().__init__(parent, text=title)
        self.rows = []
        head = ("Уровень", "Название", "Описание", "Эффекты (стат:число, ...)", "+2 к навыкам")
        for c, t in enumerate(head):
            ttk.Label(self, text=t, foreground="#888").grid(row=0, column=c, padx=4, sticky="w")
        for i in range(6):
            name, desc, fx, cap = tk.StringVar(), tk.StringVar(), tk.StringVar(), tk.BooleanVar()
            ttk.Label(self, text=f"Разум {i + 1}").grid(row=i + 1, column=0, padx=4, pady=2, sticky="w")
            ttk.Entry(self, textvariable=name, width=26).grid(row=i + 1, column=1, padx=2)
            ttk.Entry(self, textvariable=desc, width=34).grid(row=i + 1, column=2, padx=2)
            ttk.Entry(self, textvariable=fx, width=24).grid(row=i + 1, column=3, padx=2)
            ttk.Checkbutton(self, variable=cap).grid(row=i + 1, column=4)
            self.rows.append((name, desc, fx, cap))

    def set(self, minds):
        minds = minds or []
        for i, (name, desc, fx, cap) in enumerate(self.rows):
            m = minds[i] if i < len(minds) else {}
            name.set(m.get("name", "")); desc.set(m.get("desc", ""))
            fx.set(", ".join(f"{s}:{v}" for s, v in m.get("fx", [])))
            cap.set(bool(m.get("cap")))

    def get(self):
        """Список из 6 уровней или None, если всё пусто (тогда у агента будет общий Разум)."""
        out = []
        for i, (name, desc, fx, cap) in enumerate(self.rows):
            m = {"name": name.get().strip(), "desc": desc.get().strip()}
            pairs = [parse(p, "pair", f"Разум {i + 1}, эффекты") for p in fx.get().split(",") if p.strip()]
            if pairs:
                m["fx"] = pairs
            if cap.get():
                m["cap"] = True
            out.append(m)
        if not any(m["name"] or m["desc"] or m.get("fx") or m.get("cap") for m in out):
            return None
        if not all(m["name"] for m in out):
            raise ValueError("У всех 6 уровней Разума должно быть название (или очисти всё, чтобы взять общие)")
        return out


def scrollable(parent):
    canvas = tk.Canvas(parent, highlightthickness=0)
    bar = ttk.Scrollbar(parent, orient="vertical", command=canvas.yview)
    inner = ttk.Frame(canvas)
    inner.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
    canvas.create_window((0, 0), window=inner, anchor="nw")
    canvas.configure(yscrollcommand=bar.set)
    canvas.pack(side="left", fill="both", expand=True)
    bar.pack(side="right", fill="y")
    return inner


class Tab(ttk.Frame):
    """Список слева + форма справа. Кнопки: добавить, копия, удалить, вверх, вниз."""
    def __init__(self, nb, key, fields, new_item, label, idf="id", global_id=False, minds=False):
        super().__init__(nb)
        self.key, self.new_item, self.label, self.idf, self.global_id = key, new_item, label, idf, global_id
        self.cur = None
        left = ttk.Frame(self)
        left.pack(side="left", fill="y", padx=6, pady=6)
        self.lb = tk.Listbox(left, width=36, height=26, exportselection=False)
        self.lb.pack(fill="y", expand=True)
        self.lb.bind("<<ListboxSelect>>", self.on_select)
        bar = ttk.Frame(left)
        bar.pack(fill="x", pady=4)
        for text, cmd in (("＋ Новый", self.add), ("Копия", self.dup), ("Удалить", self.delete),
                          ("↑", lambda: self.move(-1)), ("↓", lambda: self.move(1))):
            ttk.Button(bar, text=text, width=8 if len(text) > 2 else 3, command=cmd).pack(side="left", padx=1)
        right = ttk.Frame(self)
        right.pack(side="left", fill="both", expand=True, padx=6, pady=6)
        inner = scrollable(right)
        form_fr = ttk.Frame(inner)
        form_fr.pack(anchor="nw")
        self.form = Form(form_fr, fields)
        self.minds = MindsEditor(inner, "Свои уровни Разума (необязательно — иначе берутся общие)") if minds else None
        if self.minds:
            self.minds.pack(anchor="nw", pady=10, padx=6)
        ttk.Button(inner, text="✔ Применить изменения", command=self.apply).pack(anchor="nw", padx=6, pady=8)

    # --- работа со списком
    def items(self):
        return APP.model[self.key]

    def pool(self):
        if self.global_id:
            return APP.model["agents"] + APP.model["weapons"] + APP.model["discs"]
        return self.items()

    def unique(self, base):
        value, n = base, 2
        while any(x.get(self.idf) == value for x in self.pool()):
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
        it = self.items()[i]
        self.form.set(it)
        if self.minds:
            self.minds.set(it.get("minds"))

    def apply(self):
        if self.cur is None:
            return True
        try:
            data = self.form.get()
            if self.minds:
                m = self.minds.get()
                if m:
                    data["minds"] = m
        except ValueError as e:
            messagebox.showerror("Ошибка в поле", str(e))
            return False
        old = self.items()[self.cur]
        if any(x is not old and x.get(self.idf) == data.get(self.idf) for x in self.pool()):
            messagebox.showerror("Ошибка", f"ID «{data.get(self.idf)}» уже занят — он должен быть уникальным.")
            return False
        keep = {k: v for k, v in old.items() if k not in data and k not in [f[0] for f in self.form.fields] and k != "minds"}
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
        self.items().append(it)
        self.refresh(len(self.items()) - 1)

    def dup(self):
        if self.cur is None or not self.apply():
            return
        it = copy.deepcopy(self.items()[self.cur])
        it[self.idf] = self.unique(it[self.idf] + "_copy")
        self.items().append(it)
        self.refresh(len(self.items()) - 1)

    def delete(self):
        if self.cur is None:
            return
        if messagebox.askyesno("Удалить", f"Удалить «{self.label(self.items()[self.cur])}»?"):
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


class General(ttk.Frame):
    """Отголоски за попытку и общий Разум по умолчанию."""
    def __init__(self, nb):
        super().__init__(nb)
        box = ttk.LabelFrame(self, text="Отголоски за каждую попытку")
        box.pack(anchor="nw", padx=10, pady=10)
        self.echo = {}
        for i, r in enumerate(RANKS):
            ttk.Label(box, text=f"Ранг {r}").grid(row=0, column=i * 2, padx=6, pady=6)
            v = tk.StringVar()
            ttk.Entry(box, textvariable=v, width=6).grid(row=0, column=i * 2 + 1)
            self.echo[r] = v
        self.minds = MindsEditor(self, "Общий Разум (для агентов без своих уровней)")
        self.minds.pack(anchor="nw", padx=10, pady=10)

    def refresh(self, **_):
        for r, v in self.echo.items():
            v.set(str(APP.model["echoes"].get(r, 0)))
        self.minds.set(APP.model["minds"])

    def apply(self):
        try:
            APP.model["echoes"] = {r: int(num(v.get() or "0")) for r, v in self.echo.items()}
            m = self.minds.get()
            if not m:
                raise ValueError("Общий Разум должен быть заполнен: нужны все 6 уровней")
            APP.model["minds"] = m
        except ValueError as e:
            messagebox.showerror("Ошибка в поле", str(e))
            return False
        return True


# ---------------------------------------------------------------- схемы полей
def lab(it):
    return f"[{it.get('rarity', '?')}] {it.get('name', '')}  ({it.get('id', '')})"


AGENT = [("id", "ID (латиницей, уникальный)", "str"), ("name", "Имя", "str"), ("rarity", "Ранг", "choice", ["S", "A"]),
         ("limited", "Только для баннера", "bool"), ("elem", "Стихия", "str"), ("role", "Роль", "str"),
         ("faction", "Фракция", "str"), ("income", "Доход ⬡ в минуту", "int"), ("impact", "Импульс", "int"),
         ("ap", "Контроль аномалии", "int"), ("am", "Знание аномалии", "int"), ("er", "Восст. энергии", "float"),
         ("image", "Иконка", "image"), ("splash", "Большой арт", "image")]
WEAPON = [("id", "ID (латиницей, уникальный)", "str"), ("name", "Название", "str"), ("rarity", "Ранг", "choice", RANKS),
          ("limited", "Только для баннера", "bool"), ("atk", "Базовая атака", "int"),
          ("sub", "Продвинутый параметр", "pair"), ("eff", "Эффект усилителя", "pair"), ("image", "Иконка", "image")]
DISC = [("id", "ID (латиницей, уникальный)", "str"), ("name", "Название", "str"), ("rarity", "Ранг", "choice", RANKS),
        ("set", "Комплект", "choice", lambda: [s["key"] for s in APP.model["sets"]]),
        ("main", "Основной параметр", "pair"), ("image", "Иконка", "image")]
SET = [("key", "Ключ комплекта (латиницей)", "str"), ("name", "Название", "str"),
       ("b2", "Бонус за 2 диска", "pair"), ("b4", "Бонус за 4 диска", "pair")]
BANNER = [("id", "ID баннера (латиницей)", "str"), ("rule", "Тип канала", "choice", ["excl", "std", "weapon"]),
          ("label", "Короткое название (слева)", "str"), ("name", "Название канала", "str"),
          ("title", "Заголовок баннера", "str"), ("end", "Окончание ГГГГ-ММ-ДД", "optstr"),
          ("featS", "S повышенного шанса (id)", "list"), ("featA", "A повышенного шанса (id)", "list"),
          ("color", "Цвет фона #rrggbb", "optstr"), ("icon", "Иконка-эмодзи", "optstr")]
SHOP_ITEM = [("tab", "Вкладка", "choice", lambda: [t["id"] for t in APP.model["shop_tabs"]]),
             ("key", "Ключ (уникальный)", "str"), ("name", "Название", "str"), ("rank", "Цвет карточки", "choice", RANKS),
             ("give", "Что выдаёт", "give"), ("price", "Цена", "int"), ("limit", "Лимит в месяц", "optint"),
             ("sale", "Скидка (текст, напр. 40%)", "optstr")]
SHOP_TAB = [("id", "ID вкладки", "str"), ("name", "Название", "str"), ("currency", "Чем платить", "choice", CURRENCIES)]


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        global APP
        APP = self
        self.title("Редактор гачи — MysticRealities")
        self.geometry("1180x800")
        try:
            self.model = load()
        except Exception as e:
            messagebox.showerror("Не удалось открыть gacha-content.js", f"{e}\n\nФайл должен лежать рядом с редактором.")
            sys.exit(1)
        top = ttk.Frame(self)
        top.pack(fill="x", padx=8, pady=6)
        ttk.Button(top, text="💾 Сохранить (Ctrl+S)", command=self.save).pack(side="left")
        ttk.Button(top, text="Проверить", command=self.check).pack(side="left", padx=6)
        ttk.Label(top, text=f"Файл: {CONTENT_FILE}", foreground="#888").pack(side="left", padx=10)
        self.nb = ttk.Notebook(self)
        self.nb.pack(fill="both", expand=True, padx=8, pady=4)
        self.tabs = [
            ("Агенты", Tab(self.nb, "agents", AGENT, {
                "id": "new_agent", "name": "Новый агент", "rarity": "A", "limited": False, "elem": "Физ.", "role": "Атака",
                "faction": "", "income": 20, "impact": 100, "ap": 90, "am": 90, "er": 1.2, "image": "", "splash": ""},
                lab, global_id=True, minds=True)),
            ("W-двигатели", Tab(self.nb, "weapons", WEAPON, {
                "id": "new_weapon", "name": "Новый W-двигатель", "rarity": "B", "limited": False, "atk": 400,
                "sub": ["hp%", 10], "eff": ["def%", 5]}, lab, global_id=True)),
            ("Диски", Tab(self.nb, "discs", DISC, {
                "id": "new_disc", "name": "Новый диск", "rarity": "B", "set": "fury", "main": ["atk", 50]}, lab, global_id=True)),
            ("Комплекты дисков", Tab(self.nb, "sets", SET, {
                "key": "new_set", "name": "Новый комплект", "b2": ["atk%", 10], "b4": ["cr", 10]},
                lambda s: f"{s['name']}  ({s['key']})", idf="key")),
            ("Баннеры", Tab(self.nb, "banners", BANNER, {
                "id": "new_banner", "rule": "excl", "label": "Выделенный", "name": "Эксклюзивный канал", "title": "Новый баннер",
                "featS": [], "featA": [], "color": "#0c1a4a"},
                lambda b: f"{b['title']}  ({b['id']})")),
            ("Товары магазина", Tab(self.nb, "shop_items", SHOP_ITEM, {
                "tab": "tape", "key": "new_item", "name": "Новый товар", "rank": "B", "give": {"master": 1}, "price": 100, "limit": None},
                lambda it: f"{it['name']}  [{it['tab']}]  ({it['key']})", idf="key")),
            ("Вкладки магазина", Tab(self.nb, "shop_tabs", SHOP_TAB, {"id": "new_tab", "name": "Новая вкладка", "currency": "money"},
                                     lambda t: f"{t['name']}  ({t['id']})")),
            ("Общее: Отголоски и Разум", General(self.nb)),
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

    def check(self):
        if not self.apply_all():
            return
        p = problems(self.model)
        messagebox.showinfo("Проверка", "Ошибок не найдено ✔" if not p else "Найдено:\n\n• " + "\n• ".join(p))

    def save(self):
        if not self.apply_all():
            return
        p = problems(self.model)
        if p and not messagebox.askyesno("Есть замечания", "Найдено:\n\n• " + "\n• ".join(p) + "\n\nВсё равно сохранить?"):
            return
        write(self.model)
        messagebox.showinfo("Готово", "Сохранено в gacha-content.js\n(резервная копия — gacha-content.js.bak).\n"
                                      "Обнови страницу с игрой (Ctrl+F5), чтобы увидеть изменения.")


if __name__ == "__main__":
    App().mainloop()
