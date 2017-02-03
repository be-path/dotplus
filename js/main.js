(function() {
	var env = {
		canvasWidth: 32,
		canvasHeight: 32,
		screenWidth: $(".canvas_wrapper").width(),
		screenHeight: $(".canvas_wrapper").height(),
		debug: false
	};

	var canvasControllers = [];
	var historyManager;

	/* ======================================================================== */
	function refreshEnv() {
		env.screenWidth = $(".canvas_wrapper").width();
		env.screenHeight = $(".canvas_wrapper").height();
		env.dotWidth = env.screenWidth / env.canvasWidth;
		env.dotHeight = env.screenHeight / env.canvasHeight;
	}

	/* screen to canvas */
	function s2c(rect) {
		return {
			x: Math.floor(rect.x * (env.canvasWidth / env.screenWidth)),
			y: Math.floor(rect.y * (env.canvasHeight / env.screenHeight)),
			w: Math.floor(rect.w * (env.canvasWidth / env.screenWidth)),
			h: Math.floor(rect.h * (env.canvasHeight / env.screenHeight)),
		};
	}

	/* canvas to screen */
	function c2s(rect) {
		return {
			x: Math.ceil(rect.x * (env.screenWidth / env.canvasWidth)),
			y: Math.ceil(rect.y * (env.screenHeight / env.canvasHeight)),
			w: Math.ceil(rect.w * (env.screenWidth / env.canvasWidth)),
			h: Math.ceil(rect.h * (env.screenHeight / env.canvasHeight)),
		};
	}

	/* screen to screen */
	function s2s(rect) {
		return c2s(s2c(rect));
	}

	function hslaToString(color) {
		var h = (color.h) ? (color.h) : 0;
		var s = (color.s) ? (color.s) : 0;
		var l = (color.l) ? (color.l) : 0;
		var a = (color.a) ? (color.a) : 0;
		return "hsla("+h+", "+s+"%, "+l+"%, "+a+")";
	}

	function checkLocalStorage() {
		if (("localStorage" in window) && (window.localStorage !== null)) {
			return true;
		}
		return false;
	}

	function saveJSON(key, data) {
		if (!checkLocalStorage()) return;
		window.localStorage.setItem(key, JSON.stringify(data));
	}

	function loadJSON(key) {
		if (!checkLocalStorage()) return;
		var result;
		try {
			result = JSON.parse(window.localStorage.getItem(key));
		} catch (e) {
			return result;
		}
		return result;
	}

	function clone(src) {
		return $.extend(true, {}, src);
	}

	/* ======================================================================== */
	class HistoryManager {
		constructor() {
			this.history = [];
			this.pointer = -1;
		}

		addHistory(type, data, caption) {
			return; // under construction
			
			while ((this.pointer < this.history.length-1) && this.history.length) {
				console.debug("pop", this.history.pop().caption);
			}
			this.history.push({
				type: type,
				data: data,
				caption: caption
			});
			this.pointer++;

			console.debug("addHistory", this.pointer, caption);
		}

		undo() {
			if (this.history.length <= 0) return;

			var p = -1;
			if (this.pointer > 0) {
				p = --this.pointer;
			}

			if (p < 0) return undefined;

			console.debug("undo", p, this.history[p].caption);
			return this.history[p];
		}

		redo() {
			if (this.history.length <= 0) return;
			var p = this.history.length;
			if (this.pointer < this.history.length-1) {
				p = ++this.pointer;
			}

			if (p > this.history.length-1) return undefined;

			console.debug("redo", p, this.history[p].caption);
			return this.history[p];
		}
	}

	/* ======================================================================== */
	class ShortcutKeyManager {
		constructor() {
			this.keyActionMap = [];

			var self = this;
			$(document).keydown(function(evt) {
				self.keyEventHandler(evt);
				evt.preventDefault();
				return false;
			});
		}

		keyToID(key_code, shift, ctrl, alt, meta) {
			var result = key_code;

			result += shift ? "_1" : "_0";
			result += ctrl  ? "_1" : "_0";
			result += alt   ? "_1" : "_0";
			result += meta  ? "_1" : "_0";

			return result;
		}

		/**
		 * addShortcutKey
		 *
		 * @param key_code
		 *   event.keyCode
		 *
		 * @param modifier
		 *   {
		 *     shift: <boolean>,
		 *     ctrl:  <boolean>,
		 *     alt:   <boolean>,
		 *     meta:  <boolean>
		 *   }
		 *
		 * @param action
		 *   callback function
		 */
		addShortcutKey(key_code, modifier, action) {
			var shift, ctrl, alt, meta;

			if (modifier) {
				shift = modifier.shift ? true : false;
				ctrl  = modifier.ctrl  ? true : false;
				alt   = modifier.alt   ? true : false;
				meta  = modifier.meta  ? true : false;
			}

			var key_id = this.keyToID(key_code, shift, ctrl, alt, meta);

			this.keyActionMap[key_id] = action;
			return this;
		}

		keyEventHandler(evt) {
			var key_id = this.keyToID(evt.keyCode, evt.shiftKey, evt.ctrlKey, evt.altKey, evt.metaKey);
			if (typeof(this.keyActionMap[key_id]) != "function") return;

			this.keyActionMap[key_id]();
		}
	}

	/* ======================================================================== */
	class Color {
		constructor(h, s, l, a) {
			// color mode: HSLA
			this.h = Math.min(360, Math.max(0, h)); // Hue        : 0-360
			this.s = Math.min(100, Math.max(0, s)); // Saturation : 0-100
			this.l = Math.min(100, Math.max(0, l)); // Lightness  : 0-100
			this.a = Math.min(1,   Math.max(0, a)); // Alpha      : 0-1
		}

		setParam(h, s, l, a) {
			if (h !== undefined) { this.h = Math.min(360, Math.max(0, h)); }
			if (s !== undefined) { this.s = Math.min(100, Math.max(0, s)); }
			if (l !== undefined) { this.l = Math.min(100, Math.max(0, l)); }
			if (a !== undefined) { this.a = Math.min(1,   Math.max(0, a)); }
		}

		compare(color) {
			if (this.h > color.h) {
				return 1;
			} else if (this.h < color.h) {
				return -1;
			} else {
				if (this.s > color.s) {
					return 1;
				} else if (this.s < color.s) {
					return -1;
				} else {
					if (this.l > color.l) {
						return 1;
					} else if (this.l < color.l) {
						return -1;
					} else {
						if (this.a > color.a) {
							return 1;
						} else if (this.a < color.a) {
							return -1;
						}
					}
				}
			}
			return 0;
		}
	}

	/* ======================================================================== */
	class ColorManager {
		constructor(paletteWrapper, colorSliderUI) {
			this.colors = [];
			this.colorsIndexMax = 256;
			this.activeIndex = 0;
			this.paletteUI = paletteWrapper.find(".palette");
			this.paletteScrollUpUI = paletteWrapper.find(".up");
			this.paletteScrollDownUI = paletteWrapper.find(".down");
			this.colorSliderUI = colorSliderUI;
			this.hueUI = this.colorSliderUI.find(".hue");
			this.saturationUI = this.colorSliderUI.find(".saturation");
			this.lightnessUI = this.colorSliderUI.find(".lightness");
			this.canvasControllers = [];
			this.hoveredIndex = -1;
			this.penCallbacks = [];

			this.makePaletteUI();
			this.setUIHandler("range");
			this.setUIHandler("number");

			this.setColor({
				h: this.hueUI.val(),
				s: this.saturationUI.val(),
				l: this.lightnessUI.val(),
				a: 1
			});

			if (env.debug) {
				this.randomColor();
			}
		}

		randomColor() {
			var color = {};
			for (var i = 256; i--; ) {
				color = {
					h: Math.round(i/256*360),
					s: 50,
					l: Math.round(Math.random()*50 + 25),
					a: 1
				};
				if (typeof(this.colors[i]) !== "object") {
					this.colors[i] = new Color(0, 0, 0, 0);
				}
				this.colors[i].setParam(color.h, color.s, color.l, color.a);
				var label = $("#color_"+i+" + label");
				label.css("background-color", hslaToString(this.colors[i]));
				label.removeClass("has_no_color");
			}
			this.updateUI();
		}

		addCanvasController(canvas_controller) {
			this.canvasControllers.push(canvas_controller);
		}

		makePaletteUI() {
			// make color elements
			var style = $("<style></style>");
			var style_inner = "";
			for (var i = 0; i < 256; i++) {
				var cell = $("<li class='orderd_cell order_"+i+"'><input id='color_"+i+"' color_index="+i+" name='colors' type='radio' /><label for='color_"+i+"' color_index="+i+" class='has_no_color'></li>");
				style_inner += ".order_"+i+" { left: "+25*(i%8)+"px; top: "+25*Math.floor(i/8)+"px; }\n";
				this.paletteUI.append(cell);
			}
			style.html(style_inner);
			$("head").append(style);
			$("#color_0").prop("checked", true);

			var self = this;

			// activate color
			this.paletteUI.find("input[name='colors']").on("change", function() {
				self.activateColor($(this).attr("color_index"));

				self.updateUI();
			});

			// indicate hovered color
			this.paletteUI.find("input[name='colors'] + label").hover(function() {
				self.hoveredIndex = $(this).attr("color_index");
				for (var i = self.canvasControllers.length; i--; ) {
					self.canvasControllers[i].render();
				}
			}, function() {
				self.hoveredIndex = -1;
				for (var i = self.canvasControllers.length; i--; ) {
					self.canvasControllers[i].render();
				}
			});

			// scroll up/down
			var scrolling = false;
			this.paletteScrollUpUI.on("click", function() {
				var target = self.paletteUI[0];
				var top = target.scrollTop - target.clientHeight/2;
				if (!scrolling) {
					scrolling = true;
					$(target).animate({scrollTop: top}, 100, undefined, function() {
						scrolling = false;
					});
				}
			});
			this.paletteScrollDownUI.on("click", function() {
				var target = self.paletteUI[0];
				var max_height = target.scrollHeight - target.clientHeight - (target.scrollHeight % target.clientHeight);
				var top = Math.min(target.scrollTop + target.clientHeight/2, max_height);
				if (!scrolling) {
					scrolling = true;
					$(target).animate({scrollTop: top}, 100, undefined, function() {
						scrolling = false;
					});
				}
			});

			// swap colors
			$(".orderd_cell").on("mousedown", function() {
				$(".swap_src").removeClass("swap_src");
				$(this).addClass("swap_src");
			}).on("mouseup", function() {
				if ($(".swap_src").length != 1) return;
				var order_swap_src = $(".swap_src");
				$(".swap_src").removeClass("swap_src");
				var order_swap_src_class = order_swap_src.attr("class");
				var order_swap_dst_class = $(this).attr("class");
				if (order_swap_src_class == order_swap_dst_class) return;

				order_swap_src.attr("class", order_swap_dst_class);
				$(this).attr("class", order_swap_src_class);
			});
			this.paletteUI.on("mouseleave", function() {
				$(".swap_src").removeClass("swap_src");
			});
		}

		setUIHandler(input_type) {
			var self = this;

			var filterInputUI = function() {
				return $(this).is("input[type='"+input_type+"']");
			};
			var hue_ui = this.hueUI.filter(filterInputUI);
			var saturation_ui = this.saturationUI.filter(filterInputUI);
			var lightness_ui = this.lightnessUI.filter(filterInputUI);

			var setColor_ = function() {
				self.setColor({
					h: hue_ui.val(),
					s: saturation_ui.val(),
					l: lightness_ui.val(),
					a: 1
				});
			};

			hue_ui.on("input", setColor_);
			saturation_ui.on("input", setColor_);
			lightness_ui.on("input", setColor_);
		}

		addPenCallback(func, caller) {
			this.penCallbacks.push({
				func: func,
				caller: caller
			});
		}

		updateUI() {
			for (var i = this.penCallbacks.length; i--; ) {
				var callback = this.penCallbacks[i];
				if (typeof(callback.func) == "function") {
					callback.func.apply(callback.caller);
				}
			}

			var index = this.getActiveColorIndex();
			this.paletteUI.find("input[color_index="+index+"]").prop("checked", true);

			var color = this.getColor(index);
			if (!color) return;

			this.hueUI.val(color.h);
			this.saturationUI.val(color.s);
			this.lightnessUI.val(color.l);

			var saturation_background = "linear-gradient(to right, "+hslaToString({
				h: color.h,
				s: 0,
				l: color.l,
				a: 1
			})+" 0%, "+hslaToString({
				h: color.h,
				s: 100,
				l: color.l,
				a: 1
			})+" 100%)";
			var lightness_background = "linear-gradient(to right, "+hslaToString({
				h: color.h,
				s: color.s,
				l: 0,
				a: 1
			})+" 0%, "+hslaToString({
				h: color.h,
				s: color.s,
				l: 50,
				a: 1
			})+" 50%, "+hslaToString({
				h: color.h,
				s: color.s,
				l: 100,
				a: 1
			})+" 100%)";

			var filterInputUI = function() {
				return $(this).is("input[type='range']");
			};
			this.saturationUI.filter(filterInputUI).css("background", saturation_background);
			this.lightnessUI.filter(filterInputUI).css("background", lightness_background);

			for (var i = this.canvasControllers.length; i--; ) {
				this.canvasControllers[i].render();
			}
		}

		setColor(color) {
			var index = this.activeIndex;
			if (index < 0 || index > this.colorsIndexMax) return;
			if (typeof(this.colors[index]) !== "object") {
				this.colors[index] = new Color(0, 0, 0, 0);
			}
			this.colors[index].setParam(color.h, color.s, color.l, color.a);
			var label = $("#color_"+this.getActiveColorIndex()+" + label");
			label.css("background-color", hslaToString(this.colors[index]));
			label.removeClass("has_no_color");
			this.updateUI();
		}

		getColor(index) {
			var index_ = index;
			if (index_ === undefined) {
				index_ = this.getActiveColorIndex();
			}
			if (index_ < 0 || index_ > this.colorsIndexMax) return;
			if (typeof(this.colors[index_]) !== "object") {
				return undefined;
			}
			return this.colors[index_];
		}

		activateColor(index) {
			this.activeIndex = index;
			this.updateUI();
		}

		getActiveColorIndex() {
			return this.activeIndex;
		}
	}

	/* ======================================================================== */
	class CanvasController {
		constructor(context, colorManager) {
			this.context = context;
			this.colorManager = colorManager;
			this.pixels = new Uint8Array(env.canvasWidth * env.canvasHeight);
			this.mask = [];

			$(context.canvas).attr("width", env.screenWidth);
			$(context.canvas).attr("height", env.screenHeight);

			this.colorManager.addCanvasController(this);

			var self = this;
			var resize_timer;
			$(window).resize(function() {
				if (resize_timer) {
					clearTimeout(resize_timer);
					resize_timer = undefined;
				}
				resize_timer = setTimeout(function() {
					$(context.canvas).attr("width", env.screenWidth);
					$(context.canvas).attr("height", env.screenHeight);
					self.render();
				}, 200);
			});

			this.render();
		}

		dot(x, y) {
			var pos = y*env.canvasWidth + x;
			this.pixels[pos] = this.colorManager.getActiveColorIndex();
			this.mask[pos] = true;
		}

		del(x, y) {
			var pos = y*env.canvasWidth + x;
			this.mask[pos] = false;
		}

		fill(x, y) {
			var index, mask, pos, x_, y_, p_;
			var flag = [];
			var p = y*env.canvasWidth + x;
			var source_index = this.pixels[p];
			var source_mask = this.mask[p] ? true : false;
			var queue = [{x: x, y: y}];
			var fill_index = this.colorManager.getActiveColorIndex();
			var ds = [
				{x:  0, y:  1},
				{x:  0, y: -1},
				{x:  1, y:  0},
				{x: -1, y:  0}
			];

			flag[p] = true;
			for (pos = queue.shift(); pos; pos = queue.shift()) {
				p = pos.y*env.canvasWidth + pos.x;

				index = this.pixels[p];
				mask = this.mask[p] ? true : false;
				if (source_mask) {
					if (index == source_index && mask == source_mask) {
						this.pixels[p] = fill_index;
						this.mask[p] = true;
					} else {
						continue;
					}
				} else {
					if (mask == source_mask) {
						this.pixels[p] = fill_index;
						this.mask[p] = true;
					} else {
						continue;
					}
				}

				for (var i = ds.length; i--; ) {
					x_ = pos.x + ds[i].x;
					y_ = pos.y + ds[i].y;
					p_ = y_*env.canvasWidth + x_;
					if (
						x_ < env.canvasWidth &&
						x_ >= 0 &&
						y_ < env.canvasHeight &&
						y_ >= 0 &&
						!flag[p_])
					{
						flag[p_] = true;
						queue.push({x: x_, y: y_});
					}
				}
			}
		}

		activateColorAt(x, y) {
			var pos = y*env.canvasWidth + x;
			if (!this.mask[pos]) return false;

			var index = this.pixels[pos];
			this.colorManager.activateColor(index);
			return true;
		}

		render() {
			var color, color_str, color_index;
			var screen_rect;
			var ctx = this.context;
			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
			for (var j = 0; j < env.canvasHeight; j++) {
				for (var i = 0; i < env.canvasWidth; i++) {
					var pos = j*env.canvasWidth + i;
					color_index = this.pixels[pos];
					color = this.colorManager.getColor(color_index);
					screen_rect = c2s({
						x: i, y: j,
						w: 1, h: 1
					});
					if (color) {
						if (this.mask[pos]) {
							// draw pixel
							ctx.fillStyle = hslaToString(color);
							ctx.fillRect(screen_rect.x, screen_rect.y, screen_rect.w, screen_rect.h);

							// draw hovered color indicator
							if (this.colorManager.hoveredIndex == color_index) {
								ctx.beginPath();
								ctx.fillStyle = hslaToString({
									h: color.h,
									s: color.s,
									l: (color.l > 50) ? 0 : 100,
									a: 0.4
								});
								ctx.arc(
									screen_rect.x + env.dotWidth/2,
									screen_rect.y + env.dotHeight/2,
									env.dotWidth/4,
									0, Math.PI*2, false
								);
								ctx.fill();
							}
						}

						// draw grid
						if (i && j) {
							ctx.lineWidth = 1;
							ctx.beginPath();
							ctx.fillStyle = hslaToString({
								h: color.h,
								s: color.s,
								l: (color.l > 50 || !this.mask[pos]) ? 0 : 100,
								a: 0.1
							});
							ctx.arc(
								screen_rect.x - 0.5,
								screen_rect.y - 0.5,
								1,
								0, Math.PI*2, false
							);
							ctx.fill();
						}
					}
				}
			}
		}

		getContiguousPixelNum(x, y) {
			var result = {
				left: 0,
				top: 0,
				right: 0,
				bottom: 0
			};

			var pos = y*env.canvasWidth + x;
			var color = this.pixels[pos];
			var mask = this.mask[pos];
			var i, j, p;

			// left
			i = x;
			while (i-- > 0) {
				p = y*env.canvasWidth + i;
				if (mask) {
					if (this.pixels[p] != color || this.mask[p] != mask) break;
				} else {
					if (this.mask[p]) break;
				}
				result.left++;
			}

			// right
			i = x;
			while (i++ < env.canvasWidth-1) {
				p = y*env.canvasWidth + i;
				if (mask) {
					if (this.pixels[p] != color || this.mask[p] != mask) break;
				} else {
					if (this.mask[p]) break;
				}
				result.right++;
			}

			// top
			j = y;
			while (j-- > 0) {
				p = j*env.canvasWidth + x;
				if (mask) {
					if (this.pixels[p] != color || this.mask[p] != mask) break;
				} else {
					if (this.mask[p]) break;
				}
				result.top++;
			}

			// bottom
			j = y;
			while (j++ < env.canvasHeight-1) {
				p = j*env.canvasWidth + x;
				if (mask) {
					if (this.pixels[p] != color || this.mask[p] != mask) break;
				} else {
					if (this.mask[p]) break;
				}
				result.bottom++;
			}

			return result;
		}
	}

	/* ======================================================================== */
	class Tool {
		constructor(button, canvas_wrapper, cursor_list) {
			this.canvasWrapper = canvas_wrapper;
			this.button = button;
			this.cursorNormal = cursor_list.normal;
			this.cursorSelect = cursor_list.select;
			this.down = false;

			var canvas = canvasControllers[0];
			canvas.colorManager.addPenCallback(this.updateUI, this);

			this.updateUI();

			var self = this;
			var pos;
			var pos_old = {
				x: -1, y: -1, w: 0, h: 0
			};

			this.button.on("change", function() {
				self.activateHandler();
			});

			this.canvasWrapper.hover(function() {
				self.cursorNormal.show();
			}, function() {
				self.cursorNormal.hide();
			});

			this.canvasWrapper.on("mousedown", function(evt) {
				if (!self.isActive()) return;
				self.down = true;
				self.mousedownAction(evt);
			});

			this.canvasWrapper.on("mouseup", function(evt) {
				if (!self.isActive()) return;
				self.down = false;
				self.mouseupAction(evt);
			});

			this.canvasWrapper.on("mouseleave", function(evt) {
				if (!self.isActive()) return;
				self.down = false;
				self.mouseleaveAction(evt);
			});

			this.canvasWrapper.on("mousemove", function(evt) {
				if (!self.isActive()) return;
				if (self.down) {
					self.mousemoveAction(evt);
				}

				pos = s2c({
					x: evt.originalEvent.offsetX,
					y: evt.originalEvent.offsetY,
					w: 0, h: 0
				});
				if (pos.x == pos_old.x && pos.y == pos_old.y) return;

				self.moveCursor(evt.originalEvent.offsetX, evt.originalEvent.offsetY);
				pos_old = pos;
			});

			this.canvasWrapper.on("click", function(evt) {
				if (!self.isActive()) return;
				self.clickAction(evt);
			});

			$("body").on("click", function(evt) {
				if (!self.isActive()) return;
				self.globalClickAction(evt);
			});
		}

		isActive() {
			return this.button.is(":checked");
		}

		moveCursor(x, y) {
			var rect_canvas = s2c({
				x: x, y: y,
				w: env.dotWidth, h: env.dotHeight
			});
			var rect_screen = c2s(rect_canvas);

			this.cursorNormal.css("left", rect_screen.x + "px");
			this.cursorNormal.css("top", rect_screen.y + "px");
			this.cursorNormal.css("width", rect_screen.w + "px");
			this.cursorNormal.css("height", rect_screen.h + "px");

			this.updateIndicator(rect_canvas);
		}

		updateIndicator(rect_canvas) {
			var canvas = canvasControllers[0];
			var distance_canvas = canvas.getContiguousPixelNum(rect_canvas.x, rect_canvas.y);
			var distance_screen_lt = c2s({
				x: distance_canvas.left, y: distance_canvas.top,
				w: 0, h: 0
			});
			var distance_screen_rb = c2s({
				x: distance_canvas.right, y: distance_canvas.bottom,
				w: 0, h: 0
			});

			var indicator, color_text;
			var pos = rect_canvas.y*env.canvasWidth + rect_canvas.x;
			var color = canvas.colorManager.getColor(canvas.pixels[pos]);
			color_text = hslaToString({
				h: 0, s: 0,
				l: (color.l > 50 || !canvas.mask[pos]) ? 0 : 100,
				a: 1
			});

			// left
			indicator = this.cursorNormal.find(".distance_indicator.left");
			indicator.css("left", (- distance_screen_lt.x) + "px");
			indicator.css("top", "0");
			indicator.css("color", color_text);
			indicator.find(".number_text").attr("value", distance_canvas.left);
			if (distance_canvas.left > 0) {
				indicator.show();
			} else {
				indicator.hide();
			}

			// top
			indicator = this.cursorNormal.find(".distance_indicator.top");
			indicator.css("left", "0");
			indicator.css("top", (- distance_screen_lt.y) + "px");
			indicator.css("color", color_text);
			indicator.find(".number_text").attr("value", distance_canvas.top);
			if (distance_canvas.top > 0) {
				indicator.show();
			} else {
				indicator.hide();
			}

			// right
			indicator = this.cursorNormal.find(".distance_indicator.right");
			indicator.css("left", distance_screen_rb.x + "px");
			indicator.css("top", "0");
			indicator.css("color", color_text);
			indicator.find(".number_text").attr("value", distance_canvas.right);
			if (distance_canvas.right > 0) {
				indicator.show();
			} else {
				indicator.hide();
			}

			// bottom
			indicator = this.cursorNormal.find(".distance_indicator.bottom");
			indicator.css("left", "0");
			indicator.css("top", distance_screen_rb.y + "px");
			indicator.css("color", color_text);
			indicator.find(".number_text").attr("value", distance_canvas.bottom);
			if (distance_canvas.bottom > 0) {
				indicator.show();
			} else {
				indicator.hide();
			}
		}

		updateUI() {
			if (!this.isActive()) return;
			var color = canvasControllers[0].colorManager.getColor();
			this.cursorNormal.css("background-color", hslaToString(color));
		}

		activateHandler() {
			this.cursorSelect.hide();
			this.updateUI();
		}

		mousedownAction(evt) {}
		mouseupAction(evt) {}
		mouseleaveAction(evt) {}
		mousemoveAction(evt) {}
		clickAction(evt) {}
		globalClickAction(evt) {}
	}

	/* ======================================================================== */
	class NormalPen extends Tool {
		constructor(button, canvas_wrapper, cursor_list) {
			super(button, canvas_wrapper, cursor_list);
		}

		penAction(evt) {
			var rect = s2c({
				x: evt.originalEvent.offsetX,
				y: evt.originalEvent.offsetY,
			});
			var canvas = canvasControllers[0];
			canvas.dot(rect.x, rect.y);
			canvas.render();
			historyManager.addHistory("canvas", clone({ pixels: canvas.pixels, mask: canvas.mask }), "pen");
		}

		mousemoveAction(evt) {
			this.penAction(evt);
		}

		clickAction(evt) {
			this.penAction(evt);
		}
	}

	/* ======================================================================== */
	class Eraser extends Tool {
		constructor(button, canvas_wrapper, cursor_list) {
			super(button, canvas_wrapper, cursor_list);
		}

		penAction(evt) {
			var rect = s2c({
				x: evt.originalEvent.offsetX,
				y: evt.originalEvent.offsetY,
			});
			var canvas = canvasControllers[0];
			canvas.del(rect.x, rect.y);
			canvas.render();
			historyManager.addHistory("canvas", clone({ pixels: canvas.pixels, mask: canvas.mask }), "eraser");
		}

		updateUI() {
			if (!this.isActive()) return;
			var color = {
				h: 0, s: 0, l: 0, a: 0
			};
			this.cursorNormal.css("background-color", hslaToString(color));
		}

		activateHandler() {
			super.activateHandler();
			this.updateUI();
		}

		mousemoveAction(evt) {
			this.penAction(evt);
		}

		clickAction(evt) {
			this.penAction(evt);
		}
	}

	/* ======================================================================== */
	class DropperPen extends Tool {
		constructor(button, canvas_wrapper, cursor_list) {
			super(button, canvas_wrapper, cursor_list);

			this.eraseMode = false;
		}

		initializeCursorUI() {
			var color = {
				h: 0, s: 0, l: 0, a: 0
			};
			this.cursorNormal.css("background-color", hslaToString(color));
		}

		updateUI() {
			if (!this.isActive()) return;

			if (this.eraseMode || !this.hasColor) {
				this.initializeCursorUI();
			} else {
				super.updateUI();
			}
		}

		dropperAction(evt) {
			this.hasColor = true;
			var rect = s2c({
				x: evt.originalEvent.offsetX,
				y: evt.originalEvent.offsetY,
			});
			var canvas = canvasControllers[0];
			this.eraseMode = false;
			if (!canvas.activateColorAt(rect.x, rect.y)) {
				this.eraseMode = true;
			}
			this.updateUI();
		}

		penAction(evt) {
			var rect = s2c({
				x: evt.originalEvent.offsetX,
				y: evt.originalEvent.offsetY,
			});
			var canvas = canvasControllers[0];
			if (this.eraseMode) {
				canvas.del(rect.x, rect.y);
			} else {
				canvas.dot(rect.x, rect.y);
			}
			canvas.render();
			historyManager.addHistory("canvas", clone({ pixels: canvas.pixels, mask: canvas.mask }), "dropper");

			this.initializeCursorUI();
			this.hasColor = false;
		}

		mousedownAction(evt) {
			this.dropperAction(evt);
		}

		mouseupAction(evt) {
			this.penAction(evt);
		}
	}

	/* ======================================================================== */
	class FillPen extends Tool {
		constructor(button, canvas_wrapper, cursor_list) {
			super(button, canvas_wrapper, cursor_list);
		}

		penAction(evt) {
			var rect = s2c({
				x: evt.originalEvent.offsetX,
				y: evt.originalEvent.offsetY,
			});
			var canvas = canvasControllers[0];
			canvas.fill(rect.x, rect.y);
			canvas.render();
			historyManager.addHistory("canvas", clone({ pixels: canvas.pixels, mask: canvas.mask }), "fill");
		}

		clickAction(evt) {
			this.penAction(evt);
		}
	}

	/* ======================================================================== */
	class Selector extends Tool {
		constructor(button, canvas_wrapper, cursor_list) {
			super(button, canvas_wrapper, cursor_list);
			this.mode = "";
			this.beginPos = undefined;
			this.endPos = undefined;
			this.clipRect = undefined;
			this.clipPixels = undefined;
			this.clipMask = undefined;
			this.movingCursorPos = undefined;
			this.selectCanvas = this.cursorSelect.find("canvas");
			this.selectCanvasContext = this.selectCanvas[0].getContext("2d");

			var self = this;
			this.cursorSelect.hover(function(evt) {
				evt.stopPropagation();
				self.cursorNormal.hide();
			}, function(evt) {
				evt.stopPropagation();
				if (self.getMode() != "select") {
					var offset =  c2s({
						x: Math.min(self.beginPos.x, self.endPos.x),
						y: Math.min(self.beginPos.y, self.endPos.y)
					});
					self.moveCursor(evt.originalEvent.offsetX + offset.x, evt.originalEvent.offsetY + offset.y);
					self.cursorNormal.show();
				}
			});

			this.cursorSelect.on("mousedown", function() {
				if (self.getMode() != "ready") return;
				self.setMode("moving");
			});
			this.cursorSelect.on("mousemove", function() {
				if (self.getMode() != "moving") return;
			});
			this.cursorSelect.on("mouseup", function() {
				if (self.getMode() != "moving") return;
			});

			$("body").on("click", function(evt) {
				var path = evt.originalEvent.path;
				var flag_do_cancel = true;
				for (var i = path.length; i--; ) {
					if (path[i] == self.canvasWrapper[0]) {
						flag_do_cancel = false;
						break;
					}
				}
				if (!flag_do_cancel) return;

				self.cancelSelect();
			});

			var resize_timer;
			$(window).resize(function() {
				if (resize_timer) {
					clearTimeout(resize_timer);
					resize_timer = undefined;
				}
				resize_timer = setTimeout(function() {
					self.cancelSelect();
					self.updateUI();
				}, 200);
			});
		}

		activateHandler() {
			super.activateHandler();
			this.cancelSelect();
			this.updateUI();
		}

		updateUI() {
			if (!this.isActive()) return;

			// normal cursor
			var color = {
				h: 0, s: 0, l: 0, a: 0
			};
			this.cursorNormal.css("background-color", hslaToString(color));

			// select cursor
			if (!this.beginPos || !this.endPos) {
				this.cursorSelect.hide();
				return;
			}

			var x = Math.min(this.beginPos.x, this.endPos.x);
			var y = Math.min(this.beginPos.y, this.endPos.y);
			var w = Math.abs(this.beginPos.x - this.endPos.x) +1;
			var h = Math.abs(this.beginPos.y - this.endPos.y) +1;
			var rect = c2s({
				x: x, y: y,
				w: w, h: h
			});
			this.cursorSelect.css("left", rect.x + "px");
			this.cursorSelect.css("top", rect.y + "px");
			this.cursorSelect.css("width", rect.w + "px");
			this.cursorSelect.css("height", rect.h + "px");
			this.cursorSelect.show();
		}

		updateSelectCanvas(resize_only) {
			if (!this.clipPixels) return;

			var rect = c2s({
				x: this.clipRect.left,
				y: this.clipRect.top,
				w: this.clipRect.width,
				h: this.clipRect.height,
			});

			this.selectCanvas.attr("width", rect.w);
			this.selectCanvas.attr("height", rect.h);

			var ctx_src = canvasControllers[0].context;
			var ctx_dst = this.selectCanvasContext;

			var image = ctx_src.getImageData(rect.x, rect.y, rect.w, rect.h);
			ctx_dst.putImageData(image, 0, 0);

			this.selectCanvas.show();
		}

		getRelativePos(evt) {
			var target_rect = evt.currentTarget.getBoundingClientRect();
			return s2c({
				x: evt.clientX - target_rect.left,
				y: evt.clientY - target_rect.top
			});
		}

		hitSelectedRange(pos) {
			if (!pos || !this.beginPos || !this.endPos) return false;

			var left = Math.min(this.beginPos.x, this.endPos.x);
			var top = Math.min(this.beginPos.y, this.endPos.y);
			var right = Math.max(this.beginPos.x, this.endPos.x);
			var bottom = Math.max(this.beginPos.y, this.endPos.y);

			if ((pos.x >= left) && (pos.x <= right) && (pos.y >= top) && (pos.y <= bottom)) {
				return true;
			}
			return false;
		}

		clipSelectedRect() {
			if (!this.beginPos || !this.endPos) return false;

			var left = Math.min(this.beginPos.x, this.endPos.x);
			var top = Math.min(this.beginPos.y, this.endPos.y);
			var width = Math.abs(this.beginPos.x - this.endPos.x) +1;
			var height = Math.abs(this.beginPos.y - this.endPos.y) +1;
			this.clipRect = {
				left: left,
				top: top,
				width: width,
				height: height
			};

			this.clipPixels = new Uint8Array(width * height);
			this.clipMask = [];
			var pos_src, pos_dst, x, y;
			for (var j = height; j--; ) {
				for (var i = width; i--; ) {
					x = left + i;
					y = top + j;
					if ((x >= env.canvasWidth) || (x < 0)) continue;
					if ((y >= env.canvasHeight) || (y < 0)) continue;

					pos_dst = j*width + i;
					pos_src = y*env.canvasWidth + x;

					if ((pos_dst >= width*height) || (pos_dst < 0)) continue;
					if ((pos_src >= env.canvasWidth*env.canvasHeight) || (pos_src < 0)) continue;

					this.clipPixels[pos_dst] = canvasControllers[0].pixels[pos_src];
					this.clipMask[pos_dst] = canvasControllers[0].mask[pos_src];
				}
			}
		}

		pasteSelectedRect() {
			var canvas = canvasControllers[0];
			var left = Math.min(this.beginPos.x, this.endPos.x);
			var top = Math.min(this.beginPos.y, this.endPos.y);
			var width = Math.abs(this.beginPos.x - this.endPos.x) +1;
			var height = Math.abs(this.beginPos.y - this.endPos.y) +1;

			var pos_src, pos_dst, x, y;
			for (var j = height; j--; ) {
				for (var i = width; i--; ) {
					x = left + i;
					y = top + j;

					if ((x >= env.canvasWidth) || (x < 0)) continue;
					if ((y >= env.canvasHeight) || (y < 0)) continue;

					pos_dst = y*env.canvasWidth + x;
					pos_src = j*width + i;

					if ((pos_dst >= env.canvasWidth*env.canvasHeight) || (pos_dst < 0)) continue;
					if ((pos_src >= width*height) || (pos_src < 0)) continue;

					if (this.clipMask[pos_src]) {
						canvas.pixels[pos_dst] = this.clipPixels[pos_src];
						canvas.mask[pos_dst] = true;
					}
				}
			}
			canvas.render();

			historyManager.addHistory("canvas", clone({ pixels: canvas.pixels, mask: canvas.mask }), "selector");
		}

		mousedownAction(evt) {
			var pos = this.getRelativePos(evt);
			switch(this.getMode()) {
				case "moving":
				this.movingCursorPos = pos;
				break;

				case "ready":
				if (this.hitSelectedRange(pos)) {
					this.setMode("moving");
				} else {
					this.setMode("select");
					this.setSelectedPoint("begin", pos, true);
					this.setSelectedPoint("end", pos, true);
					this.selectCanvas.hide();
				}
				break;

				default:
				this.setMode("select");
				this.setSelectedPoint("begin", pos, true);
				this.setSelectedPoint("end", pos, true);
				this.selectCanvas.hide();
				break;
			}
			this.cursorNormal.hide();
			this.updateUI();
		}

		mousemoveAction(evt) {
			var pos = this.getRelativePos(evt);
			switch(this.getMode()) {
				case "moving":
				var left = Math.min(this.beginPos.x, this.endPos.x);
				var top = Math.min(this.beginPos.y, this.endPos.y);
				var width = Math.abs(this.beginPos.x - this.endPos.x) +1;
				var height = Math.abs(this.beginPos.y - this.endPos.y) +1;

				var d = {
					x: pos.x - this.movingCursorPos.x,
					y: pos.y - this.movingCursorPos.y
				};
				this.setSelectedPoint("begin", {
					x: this.beginPos.x + d.x,
					y: this.beginPos.y + d.y
				}, false);
				this.setSelectedPoint("end", {
					x: this.endPos.x + d.x,
					y: this.endPos.y + d.y
				}, false);
				break;

				default:
				this.setSelectedPoint("end", pos, true);
				break;
			}
			this.movingCursorPos = pos;
			this.updateUI();
		}

		mouseupAction(evt) {
			switch(this.getMode()) {
				case "moving":
				this.setMode("ready");
				this.pasteSelectedRect();
				break;

				default:
				this.setMode("ready");
				this.setSelectedPoint("end", this.getRelativePos(evt), true);
				this.clipSelectedRect();
				this.updateSelectCanvas();
				break;
			}
			this.updateUI();
		}

		mouseleaveAction(evt) {
			switch(this.getMode()) {
				case "moving":
				this.setMode("ready");
				break;

				default:
				this.setMode("ready");
				//this.setSelectedPoint("end", this.getRelativePos(evt), true);
				break;
			}
			this.updateUI();
		}

		setSelectedPoint(phase, pos, confine) {
			var p = pos;
			if (confine) {
				p.x = Math.min(env.canvasWidth-1, Math.max(0, p.x));
				p.y = Math.min(env.canvasHeight-1, Math.max(0, p.y));
			}
			if (phase == "begin") {
				this.beginPos = p;
			} else if (phase == "end") {
				this.endPos = p;
			}
		}

		cancelSelect() {
			var mode = this.getMode();
			this.beginPos = undefined;
			this.endPos = undefined;
			this.setMode("");
			this.clipRect = {};
			this.clipPixels = undefined;
			this.clipMask = undefined;
			this.selectCanvas.hide();

			this.updateUI();
		}

		setMode(mode) {
			this.mode = mode;
		}

		getMode() {
			return this.mode;
		}
	}

	/* ======================================================================== */
	$(document).ready(function() {
		refreshEnv();
		var resize_timer;
		$(window).resize(function() {
			if (resize_timer) {
				clearTimeout(resize_timer);
				resize_timer = undefined;
			}
			resize_timer = setTimeout(refreshEnv, 100);
		});

		historyManager = new HistoryManager();

		var colorManager = new ColorManager($(".palette_wrapper"), $(".color_selector"));

		canvasControllers.push(new CanvasController(
			$("#canvas_main")[0].getContext("2d"),
			colorManager
		));
		historyManager.addHistory("canvas", clone({ pixels: canvasControllers[0].pixels, mask: canvasControllers[0].mask }), "init");

		var cursor_list = {
			normal: $(".cursor_normal"),
			select: $(".cursor_select")
		};
		new NormalPen($("#tool_pen"), $(".canvas_wrapper"), cursor_list);
		new Eraser($("#tool_eraser"), $(".canvas_wrapper"), cursor_list);
		new DropperPen($("#tool_dpen"), $(".canvas_wrapper"), cursor_list);
		new FillPen($("#tool_fill"), $(".canvas_wrapper"), cursor_list);
		new Selector($("#tool_selector"), $(".canvas_wrapper"), cursor_list);

		var shortcutKeyManager = new ShortcutKeyManager();
		shortcutKeyManager.addShortcutKey(
			70, // f
			undefined,
			function() {
				$("#tool_pen").prop("checked", true).change();
			}
		).addShortcutKey(
			68, // d
			undefined,
			function() {
				$("#tool_eraser").prop("checked", true).change();
			}
		).addShortcutKey(
			83, // s
			undefined,
			function() {
				$("#tool_dpen").prop("checked", true).change();
			}
		).addShortcutKey(
			65, // a
			undefined,
			function() {
				$("#tool_fill").prop("checked", true).change();
			}
		).addShortcutKey(
			82, // r
			undefined,
			function() {
				$("#tool_selector").prop("checked", true).change();
			}
		).addShortcutKey(
			90, // z
			undefined,
			function() {
				var history = historyManager.undo();
				if (history) {
					canvasControllers[0].pixels = history.data.pixels;
					canvasControllers[0].mask = history.data.mask;
					canvasControllers[0].render();
				}
			}
		).addShortcutKey(
			88, // x
			undefined,
			function() {
				var history = historyManager.redo();
				if (history) {
					canvasControllers[0].pixels = history.data.pixels;
					canvasControllers[0].mask = history.data.mask;
					canvasControllers[0].render();
				}
			}
		);
	});
})();
