extends Control

const BG_TOP := Color("07101f")
const BG_BOTTOM := Color("170d24")
const WHITE := Color("f6f7ff")
const CYAN := Color("62e7ff")
const VIOLET := Color("9875ff")
const PINK := Color("ff5fcf")

var t := 0.0
var entering := false
var enter_t := 0.0
var pulse := 0.0
var stars: Array[Vector3] = []

func _ready() -> void:
	set_process(true)
	set_process_input(true)
	for i in 72:
		var seed_x := fposmod(float(i * 83 + 17), 997.0) / 997.0
		var seed_y := fposmod(float(i * 47 + 91), 991.0) / 991.0
		var seed_s := 0.35 + fposmod(float(i * 31), 67.0) / 100.0
		stars.append(Vector3(seed_x, seed_y, seed_s))
	queue_redraw()

func _process(delta: float) -> void:
	t += delta
	pulse = 0.5 + 0.5 * sin(t * 2.1)
	if entering:
		enter_t = min(1.0, enter_t + delta * 2.4)
	queue_redraw()

func _input(event: InputEvent) -> void:
	if entering:
		return
	if event is InputEventScreenTouch and event.pressed:
		_begin_enter()
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_begin_enter()
	elif event.is_action_pressed("ui_accept"):
		_begin_enter()

func _begin_enter() -> void:
	entering = true
	enter_t = 0.0

func _draw() -> void:
	var s := size
	_draw_gradient(s)
	_draw_stars(s)

	var center := Vector2(s.x * 0.5, s.y * 0.43)
	var intro := clamp(t / 1.1, 0.0, 1.0)
	var ease := 1.0 - pow(1.0 - intro, 3.0)
	var exit_scale := 1.0 + enter_t * 0.2
	var exit_alpha := 1.0 - pow(enter_t, 1.5)

	_draw_glow(center, 118.0 * exit_scale, exit_alpha)
	_draw_gem(center + Vector2(0, -18), 63.0 * (0.88 + 0.12 * ease) * exit_scale, exit_alpha)
	_draw_wordmark(center + Vector2(0, 104), ease, exit_alpha)
	_draw_subtitle(center + Vector2(0, 150), exit_alpha)
	_draw_prompt(Vector2(s.x * 0.5, s.y * 0.81), exit_alpha)

	if entering:
		var a := smoothstep(0.55, 1.0, enter_t)
		draw_rect(Rect2(Vector2.ZERO, s), Color(0.01, 0.012, 0.022, a))
		if enter_t >= 0.98:
			_draw_center_text("WORLD PROTOTYPE NEXT", Vector2(s.x * 0.5, s.y * 0.5), 18, Color(WHITE, 0.72))

func _draw_gradient(s: Vector2) -> void:
	var bands := 48
	for i in bands:
		var q := float(i) / float(bands - 1)
		var c := BG_TOP.lerp(BG_BOTTOM, q)
		draw_rect(Rect2(0, s.y * q, s.x, s.y / bands + 2), c)

	var horizon := Vector2(s.x * 0.5, s.y * 0.41)
	for i in range(12, 0, -1):
		var r := 80.0 + i * 34.0
		var alpha := 0.006 * (13 - i)
		draw_circle(horizon, r, Color(VIOLET, alpha))

func _draw_stars(s: Vector2) -> void:
	for i in stars.size():
		var st := stars[i]
		var drift := fposmod(st.y + t * (0.002 + st.z * 0.001), 1.0)
		var p := Vector2(st.x * s.x, drift * s.y)
		var twinkle := 0.18 + 0.28 * (0.5 + 0.5 * sin(t * (1.0 + st.z) + float(i)))
		draw_circle(p, 0.7 + st.z * 0.7, Color(WHITE, twinkle))

func _draw_glow(center: Vector2, radius: float, alpha: float) -> void:
	for i in range(14, 0, -1):
		var q := float(i) / 14.0
		var c := CYAN.lerp(PINK, 1.0 - q)
		c.a = alpha * 0.012 * (15 - i)
		draw_circle(center, radius * q, c)

func _draw_gem(center: Vector2, radius: float, alpha: float) -> void:
	var bob := sin(t * 1.7) * 5.0
	var c := center + Vector2(0, bob)
	var pts := PackedVector2Array([
		c + Vector2(0, -radius),
		c + Vector2(radius * 0.72, -radius * 0.32),
		c + Vector2(radius * 0.58, radius * 0.55),
		c + Vector2(0, radius),
		c + Vector2(-radius * 0.58, radius * 0.55),
		c + Vector2(-radius * 0.72, -radius * 0.32),
	])
	var gem_color := CYAN.lerp(VIOLET, 0.48 + 0.12 * sin(t * 0.8))
	gem_color.a = alpha
	draw_colored_polygon(pts, gem_color)

	var inner := PackedVector2Array([
		c + Vector2(0, -radius * 0.78),
		c + Vector2(radius * 0.42, -radius * 0.22),
		c + Vector2(0, radius * 0.72),
		c + Vector2(-radius * 0.42, -radius * 0.22),
	])
	draw_colored_polygon(inner, Color(0.86, 0.95, 1.0, alpha * 0.22))

	var edge := Color(WHITE, alpha * (0.48 + pulse * 0.18))
	for i in pts.size():
		draw_line(pts[i], pts[(i + 1) % pts.size()], edge, 1.5, true)

	var shine_from := c + Vector2(-radius * 0.28, -radius * 0.31)
	var shine_to := c + Vector2(radius * 0.03, -radius * 0.63)
	draw_line(shine_from, shine_to, Color(WHITE, alpha * 0.72), 3.0, true)

func _draw_wordmark(pos: Vector2, intro: float, alpha: float) -> void:
	var font := ThemeDB.fallback_font
	var text := "GemMO"
	var font_size := 52
	var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	var p := pos - Vector2(width * 0.5, 0)
	var rise := (1.0 - intro) * 20.0
	var shadow := Color(0.0, 0.0, 0.0, alpha * 0.35)
	draw_string(font, p + Vector2(0, 3 + rise), text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, shadow)
	draw_string(font, p + Vector2(0, rise), text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, Color(WHITE, alpha))

	# tiny gem-like accent under the MMO half
	var y := pos.y + 13 + rise
	draw_line(Vector2(pos.x - 4, y), Vector2(pos.x + width * 0.34, y), Color(CYAN, alpha * 0.6), 2.0, true)

func _draw_subtitle(pos: Vector2, alpha: float) -> void:
	_draw_center_text("MATCH  •  BUILD  •  CONQUER", pos, 13, Color(0.78, 0.82, 0.95, alpha * 0.68))

func _draw_prompt(pos: Vector2, alpha: float) -> void:
	var a := alpha * (0.45 + pulse * 0.35)
	_draw_center_text("TAP TO ENTER", pos, 16, Color(WHITE, a))
	var w := 124.0
	draw_line(pos + Vector2(-w * 0.5, 14), pos + Vector2(w * 0.5, 14), Color(CYAN, a * 0.45), 1.0, true)

func _draw_center_text(text: String, pos: Vector2, font_size: int, color: Color) -> void:
	var font := ThemeDB.fallback_font
	var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	draw_string(font, pos - Vector2(width * 0.5, 0), text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, color)
