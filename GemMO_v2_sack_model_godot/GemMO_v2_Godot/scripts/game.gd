extends Control

const BG := Color("07101b")
const PANEL := Color("0d1728")
const LINE := Color("23324c")
const WHITE := Color("f4f7ff")
const MUTED := Color("8391aa")
const RED := Color("f25c67")
const BLUE := Color("579cff")
const GREEN := Color("55d68a")
const YELLOW := Color("f4c54f")
const PURPLE := Color("a979ff")
const GOLD := Color("f1b942")
const XP := Color("63e7ff")
const ENV := Color("8a9a88")
const WILD := Color("ffffff")

const COLS := 8
const ROWS := 8
const TYPES := ["red", "blue", "green", "yellow", "purple", "gold", "xp", "env"]
const WEIGHTS := [15, 15, 15, 15, 15, 10, 8, 7]

var state := "splash"
var t := 0.0
var board: Array = []
var selected := Vector2i(-1, -1)
var resolving := false
var player_turn := true
var extra_move := false
var free_swap := false
var player_hp := 24
var enemy_hp := 24
var player_guard := 0
var enemy_guard := 0
var gold_count := 0
var xp_count := 0
var charges := {"red": 0, "blue": 0, "green": 0, "yellow": 0, "purple": 0}
var enemy_charges := {"red": 0, "blue": 0, "green": 0, "yellow": 0, "purple": 0}
var enemy_reload := false
var overdrive := false
var combat_log := "Random board. Your colors use your Sack."
var ai_wait := 0.0
var won := false
var lost := false

var slot_names := {
	"red": "SLASH",
	"blue": "GUARD",
	"green": "MEND",
	"yellow": "QUICKSTEP",
	"purple": "OVERDRIVE"
}

func _ready() -> void:
	set_process(true)
	set_process_input(true)
	queue_redraw()

func _process(delta: float) -> void:
	t += delta
	if state == "battle" and not player_turn and not resolving and not won and not lost:
		ai_wait -= delta
		if ai_wait <= 0.0:
			_enemy_move()
	queue_redraw()

func _input(event: InputEvent) -> void:
	if state == "splash":
		if (event is InputEventScreenTouch and event.pressed) or (event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT):
			_start_battle()
		return
	if state != "battle" or resolving or won or lost:
		return
	if not player_turn:
		return
	var pressed := false
	var pos := Vector2.ZERO
	if event is InputEventScreenTouch and event.pressed:
		pressed = true
		pos = event.position
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		pressed = true
		pos = event.position
	if not pressed:
		return
	if not free_swap and _handle_slot_tap(pos):
		return
	var cell := _cell_at(pos)
	if cell.x < 0:
		selected = Vector2i(-1, -1)
		return
	if selected.x < 0:
		selected = cell
	else:
		var dist := abs(selected.x - cell.x) + abs(selected.y - cell.y)
		if dist == 1:
			var a := selected
			selected = Vector2i(-1, -1)
			if free_swap:
				free_swap = false
				_try_swap(a, cell, true, true)
			else:
				_try_swap(a, cell, true)
		else:
			selected = cell

func _start_battle() -> void:
	state = "battle"
	_new_board()
	queue_redraw()

func _new_board() -> void:
	board.clear()
	for y in ROWS:
		var row: Array = []
		for x in COLS:
			var kind := _roll_type()
			var guard := 0
			while guard < 20 and _would_make_initial_match(row, x, y, kind):
				kind = _roll_type()
				guard += 1
			row.append(kind)
		board.append(row)
	_ensure_legal_move()

func _would_make_initial_match(row: Array, x: int, y: int, kind: String) -> bool:
	if x >= 2 and row[x - 1] == kind and row[x - 2] == kind:
		return true
	if y >= 2 and board[y - 1][x] == kind and board[y - 2][x] == kind:
		return true
	return false

func _roll_type() -> String:
	var total := 0
	for w in WEIGHTS:
		total += w
	var r := randi_range(1, total)
	var acc := 0
	for i in TYPES.size():
		acc += WEIGHTS[i]
		if r <= acc:
			return TYPES[i]
	return "red"

func _cell_at(pos: Vector2) -> Vector2i:
	var rect := _board_rect()
	if not rect.has_point(pos):
		return Vector2i(-1, -1)
	var cell_size := rect.size.x / COLS
	return Vector2i(int((pos.x - rect.position.x) / cell_size), int((pos.y - rect.position.y) / cell_size))

func _board_rect() -> Rect2:
	var width := min(size.x - 24.0, 520.0)
	var top := 166.0
	return Rect2(Vector2((size.x - width) * 0.5, top), Vector2(width, width))

func _swap(a: Vector2i, b: Vector2i) -> void:
	var tmp = board[a.y][a.x]
	board[a.y][a.x] = board[b.y][b.x]
	board[b.y][b.x] = tmp

func _try_swap(a: Vector2i, b: Vector2i, from_player: bool, force_swap: bool = false) -> bool:
	# Wild + any normal gem is a valid detonation swap.
	if board[a.y][a.x] == "wild" or board[b.y][b.x] == "wild":
		_swap(a, b)
		_resolve_wild_swap(a, b, from_player)
		return true
	_swap(a, b)
	var matches := _find_matches()
	if matches.is_empty():
		if force_swap:
			combat_log = "QUICKSTEP repositions the board."
			_after_action(from_player)
			return true
		_swap(a, b)
		combat_log = "No match."
		return false
	_resolve_matches(matches, from_player, b)
	return true

func _find_matches() -> Dictionary:
	var matched := {}
	var runs: Array = []
	for y in ROWS:
		var x := 0
		while x < COLS:
			var kind: String = board[y][x]
			if kind == "wild":
				x += 1
				continue
			var end := x + 1
			while end < COLS and board[y][end] == kind:
				end += 1
			var length := end - x
			if length >= 3:
				var cells: Array = []
				for xx in range(x, end):
					var p := Vector2i(xx, y)
					matched[p] = true
					cells.append(p)
				runs.append({"kind": kind, "cells": cells, "length": length})
			x = end
	for x in COLS:
		var y := 0
		while y < ROWS:
			var kind: String = board[y][x]
			if kind == "wild":
				y += 1
				continue
			var end := y + 1
			while end < ROWS and board[end][x] == kind:
				end += 1
			var length := end - y
			if length >= 3:
				var cells: Array = []
				for yy in range(y, end):
					var p := Vector2i(x, yy)
					matched[p] = true
					cells.append(p)
				runs.append({"kind": kind, "cells": cells, "length": length})
			y = end
	return {"cells": matched, "runs": runs} if not matched.is_empty() else {}

func _resolve_matches(matches: Dictionary, from_player: bool, swap_target: Vector2i) -> void:
	resolving = true
	var cells: Dictionary = matches["cells"]
	var counts := {}
	for p in cells.keys():
		var kind: String = board[p.y][p.x]
		counts[kind] = int(counts.get(kind, 0)) + 1

	var wild_at := Vector2i(-1, -1)
	for run in matches["runs"]:
		if int(run["length"]) >= 5:
			if cells.has(swap_target) and board[swap_target.y][swap_target.x] == run["kind"]:
				wild_at = swap_target
			else:
				wild_at = run["cells"][int(run["cells"].size() / 2)]
			break

	var made_four := false
	for run in matches["runs"]:
		if int(run["length"]) >= 4:
			made_four = true
	if from_player and made_four and swap_target.x >= 0:
		extra_move = true

	_apply_counts(counts, from_player)
	for p in cells.keys():
		board[p.y][p.x] = ""
	if wild_at.x >= 0:
		board[wild_at.y][wild_at.x] = "wild"
		combat_log += "  WILD forged!"
	_collapse_and_refill()
	_check_end()
	if won or lost:
		resolving = false
		return
	# Cascades resolve for the same actor.
	var cascade := _find_matches()
	if not cascade.is_empty():
		_resolve_matches(cascade, from_player, Vector2i(-1, -1))
		return
	resolving = false
	_after_action(from_player)

func _resolve_wild_swap(a: Vector2i, b: Vector2i, from_player: bool) -> void:
	resolving = true
	var wild_pos := a if board[a.y][a.x] == "wild" else b
	var other_pos := b if wild_pos == a else a
	var target: String = board[other_pos.y][other_pos.x]
	if target == "wild":
		for y in ROWS:
			for x in COLS:
				board[y][x] = ""
		combat_log = "DOUBLE WILD — the board fractures."
	else:
		var count := 0
		for y in ROWS:
			for x in COLS:
				if board[y][x] == target:
					board[y][x] = ""
					count += 1
		board[wild_pos.y][wild_pos.x] = ""
		var counts := {target: count}
		_apply_counts(counts, from_player)
		combat_log += "  Wild consumed every %s gem." % target.to_upper()
	_collapse_and_refill()
	resolving = false
	_check_end()
	if not won and not lost:
		_after_action(from_player)

func _apply_counts(counts: Dictionary, from_player: bool) -> void:
	var actor := "You" if from_player else "Bandit"
	var notes: Array[String] = []
	for kind in counts.keys():
		var n := int(counts[kind])
		var mult := 1
		if from_player and overdrive and kind in ["red", "blue", "green", "yellow", "purple"]:
			mult = 2
		for color in ["red", "blue", "green", "yellow", "purple"]:
			if kind == color:
				if from_player:
					var cap := {"red":7,"blue":7,"green":6,"yellow":6,"purple":10}[color]
					charges[color] = min(cap, charges[color] + n * mult)
				else:
					var ecap := {"red":7,"blue":7,"green":6,"yellow":6,"purple":10}[color]
					enemy_charges[color] = min(ecap, enemy_charges[color] + n)
		match kind:
			"red":
				if from_player:
					var dmg := n * mult
					_damage_enemy(dmg)
					notes.append("SLASH %d" % dmg)
				else:
					var dmg := n + (2 if enemy_reload else 0)
					enemy_reload = false
					_damage_player(dmg)
					notes.append("BOLT %d" % dmg)
			"blue":
				if from_player:
					player_guard += n * mult
					notes.append("GUARD +%d" % (n * mult))
				else:
					var evade := int(ceil(n * 0.75))
					enemy_guard += evade
					notes.append("EVADE +%d" % evade)
			"gold":
				if from_player:
					gold_count += n
					notes.append("GOLD +%d" % n)
			"xp":
				if from_player:
					xp_count += n
					notes.append("XP +%d" % n)
			"env":
				_damage_player(1)
				_damage_enemy(1)
				notes.append("RIFT 1/1")
		if mult == 2:
			overdrive = false
			notes.append("OVERDRIVE x2")
	if notes.size() > 0:
		combat_log = "%s: %s" % [actor, "  •  ".join(notes)]

func _damage_player(amount: int) -> void:
	var blocked := min(player_guard, amount)
	player_guard -= blocked
	player_hp -= amount - blocked

func _damage_enemy(amount: int) -> void:
	var blocked := min(enemy_guard, amount)
	enemy_guard -= blocked
	enemy_hp -= amount - blocked

func _collapse_and_refill() -> void:
	for x in COLS:
		var kept: Array = []
		for y in range(ROWS - 1, -1, -1):
			if board[y][x] != "":
				kept.append(board[y][x])
		var idx := 0
		for y in range(ROWS - 1, -1, -1):
			if idx < kept.size():
				board[y][x] = kept[idx]
				idx += 1
			else:
				board[y][x] = _roll_type()
	_ensure_legal_move()

func _after_action(from_player: bool) -> void:
	if from_player:
		if extra_move:
			extra_move = false
			player_turn = true
			combat_log += "  Extra move."
		else:
			player_turn = false
			ai_wait = 0.55
	else:
		player_turn = true
	_check_end()

func _handle_slot_tap(pos: Vector2) -> bool:
	var rects := _slot_rects()
	var kinds := ["red", "blue", "green", "yellow", "purple"]
	var caps := {"red":7,"blue":7,"green":6,"yellow":6,"purple":10}
	for i in rects.size():
		if rects[i].has_point(pos):
			var kind: String = kinds[i]
			if charges[kind] < caps[kind]:
				combat_log = "%s needs %d more charge." % [slot_names[kind], caps[kind] - charges[kind]]
				return true
			charges[kind] = 0
			match kind:
				"red":
					_damage_enemy(6)
					combat_log = "HEAVY SLASH: 6 damage."
					_after_action(true)
				"blue":
					player_guard += 6
					combat_log = "BRACE: +6 Guard."
					_after_action(true)
				"green":
					player_hp = min(24, player_hp + 5)
					combat_log = "MEND: +5 HP."
					_after_action(true)
				"yellow":
					free_swap = true
					selected = Vector2i(-1, -1)
					combat_log = "QUICKSTEP: choose any gem, then an adjacent gem."
				"purple":
					overdrive = true
					combat_log = "OVERDRIVE: next colored match triggers x2."
					_after_action(true)
			_check_end()
			return true
	return false

func _slot_rects() -> Array[Rect2]:
	var gap := 5.0
	var total_w := min(size.x - 20.0, 520.0)
	var w := (total_w - gap * 4.0) / 5.0
	var y := size.y - 96.0
	var left := (size.x - total_w) * 0.5
	var out: Array[Rect2] = []
	for i in 5:
		out.append(Rect2(left + i * (w + gap), y, w, 78.0))
	return out

func _enemy_move() -> void:
	if _enemy_use_active():
		return
	var moves := _legal_moves()
	if moves.is_empty():
		_new_board()
		combat_log = "The sacks churn."
		player_turn = true
		return
	var best = moves[0]
	var best_score := -999
	for move in moves:
		var a: Vector2i = move[0]
		var b: Vector2i = move[1]
		_swap(a, b)
		var m := _find_matches()
		var score := 0
		if not m.is_empty():
			for p in m["cells"].keys():
				match board[p.y][p.x]:
					"red": score += 4
					"purple": score += 3
					"yellow": score += 2
					"green": score += 2
					"blue": score += 1
		_swap(a, b)
		if score > best_score:
			best_score = score
			best = move
	_try_swap(best[0], best[1], false)

func _enemy_use_active() -> bool:
	if enemy_charges["purple"] >= 10:
		enemy_charges["purple"] = 0
		_damage_player(6)
		combat_log = "Bandit uses DEADEYE: 6 damage."
		player_turn = true
		_check_end()
		return true
	if enemy_charges["green"] >= 6 and enemy_hp <= 18:
		enemy_charges["green"] = 0
		enemy_hp = min(24, enemy_hp + 5)
		combat_log = "Bandit uses BANDAGE: +5 HP."
		player_turn = true
		return true
	if enemy_charges["red"] >= 7:
		enemy_charges["red"] = 0
		_damage_player(5)
		combat_log = "Bandit uses QUICK SHOT: 5 damage."
		player_turn = true
		_check_end()
		return true
	if enemy_charges["blue"] >= 7 and enemy_guard <= 2:
		enemy_charges["blue"] = 0
		enemy_guard += 6
		combat_log = "Bandit uses SIDESTEP: +6 Evade."
		player_turn = true
		return true
	if enemy_charges["yellow"] >= 6:
		enemy_charges["yellow"] = 0
		enemy_reload = true
		combat_log = "Bandit uses RELOAD: next Bolt +2."
		player_turn = true
		return true
	return false

func _legal_moves() -> Array:
	var out: Array = []
	for y in ROWS:
		for x in COLS:
			var a := Vector2i(x, y)
			if x + 1 < COLS:
				var b := Vector2i(x + 1, y)
				if board[y][x] == "wild" or board[y][x + 1] == "wild":
					out.append([a, b])
				else:
					_swap(a, b)
					if not _find_matches().is_empty(): out.append([a, b])
					_swap(a, b)
			if y + 1 < ROWS:
				var b := Vector2i(x, y + 1)
				if board[y][x] == "wild" or board[y + 1][x] == "wild":
					out.append([a, b])
				else:
					_swap(a, b)
					if not _find_matches().is_empty(): out.append([a, b])
					_swap(a, b)
	return out

func _ensure_legal_move() -> void:
	# Avoid recursive churn while the board is partially empty.
	for y in ROWS:
		for x in COLS:
			if board[y][x] == "":
				return
	if _legal_moves().is_empty():
		_new_board()

func _check_end() -> void:
	if enemy_hp <= 0:
		enemy_hp = 0
		won = true
		combat_log = "VICTORY — your Sack wins the board."
	elif player_hp <= 0:
		player_hp = 0
		lost = true
		combat_log = "DEFEAT — the Bandit wins the board."

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), BG)
	if state == "splash":
		_draw_splash()
	else:
		_draw_battle()

func _draw_splash() -> void:
	var center := Vector2(size.x * 0.5, size.y * 0.43)
	for i in range(10, 0, -1):
		draw_circle(center, 24.0 + i * 12.0, Color(PURPLE, 0.008 * (11 - i)))
	_draw_gem(center, 56.0, PURPLE)
	_center_text("GemMO", center + Vector2(0, 112), 50, WHITE)
	_center_text("RANDOM BOARD. YOUR SACK DEFINES THE COLORS.", center + Vector2(0, 151), 12, MUTED)
	var pulse := 0.55 + sin(t * 2.3) * 0.2
	_center_text("TAP TO FIGHT", Vector2(size.x * 0.5, size.y * 0.82), 16, Color(WHITE, pulse))

func _draw_battle() -> void:
	_draw_top_status()
	_draw_board()
	_draw_log()
	_draw_slots()
	if won or lost:
		draw_rect(Rect2(Vector2.ZERO, size), Color(0, 0, 0, 0.62))
		_center_text("VICTORY" if won else "DEFEAT", Vector2(size.x * 0.5, size.y * 0.47), 42, WHITE)
		_center_text("Reload prototype to rematch", Vector2(size.x * 0.5, size.y * 0.52), 14, MUTED)

func _draw_top_status() -> void:
	var margin := 12.0
	draw_rect(Rect2(margin, 12, size.x - margin * 2, 64), PANEL, true)
	draw_rect(Rect2(margin, 12, size.x - margin * 2, 64), LINE, false, 1.0)
	_text("YOU", Vector2(margin + 12, 32), 13, WHITE)
	_text("HP %d/24   GUARD %d" % [player_hp, player_guard], Vector2(margin + 12, 55), 16, WHITE)
	var foe := "BANDIT"
	var fw := ThemeDB.fallback_font.get_string_size(foe, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
	_text(foe, Vector2(size.x - margin - 12 - fw, 32), 13, MUTED)
	var stat := "HP %d/24   EVADE %d" % [enemy_hp, enemy_guard]
	var sw := ThemeDB.fallback_font.get_string_size(stat, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
	_text(stat, Vector2(size.x - margin - 12 - sw, 55), 16, WHITE)
	_center_text("YOUR MOVE" if player_turn else "BANDIT MOVES", Vector2(size.x * 0.5, 104), 14, GREEN if player_turn else RED)
	_center_text("Random board. Same colors. Different Sacks.", Vector2(size.x * 0.5, 128), 11, MUTED)

func _draw_board() -> void:
	var rect := _board_rect()
	var cs := rect.size.x / COLS
	draw_rect(rect.grow(4), Color("050a12"), true)
	draw_rect(rect.grow(4), LINE, false, 2.0)
	for y in ROWS:
		for x in COLS:
			var cell := Rect2(rect.position + Vector2(x * cs, y * cs), Vector2(cs, cs))
			draw_rect(cell.grow(-1.5), PANEL, true)
			var kind: String = board[y][x]
			_draw_tile(cell.get_center(), cs * 0.34, kind)
			if selected == Vector2i(x, y):
				draw_rect(cell.grow(-2), WHITE, false, 2.0)

func _draw_tile(c: Vector2, r: float, kind: String) -> void:
	var color := _color_for(kind)
	if kind == "gold":
		draw_circle(c, r * 0.82, Color(color, 0.95))
		draw_circle(c, r * 0.52, Color(BG, 0.45))
		_center_text("$", c + Vector2(0, 6), int(r * 0.75), WHITE)
		return
	if kind == "xp":
		_draw_diamond(c, r, color)
		_center_text("+", c + Vector2(0, 5), int(r * 0.72), BG)
		return
	if kind == "env":
		_draw_diamond(c, r, color)
		_center_text("✦", c + Vector2(0, 5), int(r * 0.58), WHITE)
		return
	if kind == "wild":
		for i in 5:
			_draw_diamond(c, r - i * 2.2, [RED, YELLOW, GREEN, BLUE, PURPLE][i])
		_center_text("W", c + Vector2(0, 5), int(r * 0.6), BG)
		return
	_draw_diamond(c, r, color)
	var icon := {"red":"╱", "blue":"◇", "green":"+", "yellow":"»", "purple":"✦"}.get(kind, "")
	_center_text(icon, c + Vector2(0, 5), int(r * 0.72), WHITE)

func _draw_diamond(c: Vector2, r: float, color: Color) -> void:
	var pts := PackedVector2Array([c + Vector2(0,-r), c + Vector2(r,0), c + Vector2(0,r), c + Vector2(-r,0)])
	draw_colored_polygon(pts, color)
	draw_polyline(PackedVector2Array([pts[0],pts[1],pts[2],pts[3],pts[0]]), Color(WHITE,0.38), 1.2, true)

func _draw_log() -> void:
	var br := _board_rect()
	var y := br.end.y + 18.0
	var label := "LOOT  $%d    XP %d" % [gold_count, xp_count]
	_text(label, Vector2(14, y), 12, MUTED)
	var max_chars := 56
	var msg := combat_log
	if msg.length() > max_chars:
		msg = msg.substr(0, max_chars - 1) + "…"
	_text(msg, Vector2(14, y + 25), 13, WHITE)

func _draw_slots() -> void:
	var kinds := ["red", "blue", "green", "yellow", "purple"]
	var caps := {"red":7,"blue":7,"green":6,"yellow":6,"purple":10}
	var actives := {"red":"HEAVY", "blue":"BRACE", "green":"MEND", "yellow":"SWAP", "purple":"x2"}
	var rects := _slot_rects()
	for i in 5:
		var kind: String = kinds[i]
		var r: Rect2 = rects[i]
		var color := _color_for(kind)
		draw_rect(r, PANEL, true)
		draw_rect(r, Color(color, 0.9), false, 1.5)
		draw_circle(Vector2(r.position.x + r.size.x * 0.5, r.position.y + 16), 8, color)
		_center_text(slot_names[kind], Vector2(r.position.x + r.size.x * 0.5, r.position.y + 38), 9, WHITE)
		var ready: bool = charges[kind] >= caps[kind]
		var sub := "%d/%d" % [charges[kind], caps[kind]]
		if ready:
			draw_rect(r.grow(-3), Color(WHITE, 0.10), true)
			sub = actives[kind]
		_center_text(sub, Vector2(r.position.x + r.size.x * 0.5, r.position.y + 61), 9, WHITE if ready else color)

func _color_for(kind: String) -> Color:
	match kind:
		"red": return RED
		"blue": return BLUE
		"green": return GREEN
		"yellow": return YELLOW
		"purple": return PURPLE
		"gold": return GOLD
		"xp": return XP
		"env": return ENV
		"wild": return WILD
	return WHITE

func _draw_gem(c: Vector2, r: float, color: Color) -> void:
	_draw_diamond(c, r, color)
	_draw_diamond(c, r * 0.62, Color(WHITE, 0.15))

func _text(text: String, pos: Vector2, font_size: int, color: Color) -> void:
	draw_string(ThemeDB.fallback_font, pos, text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, color)

func _center_text(text: String, pos: Vector2, font_size: int, color: Color) -> void:
	var font := ThemeDB.fallback_font
	var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	draw_string(font, pos - Vector2(width * 0.5, 0), text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, color)
