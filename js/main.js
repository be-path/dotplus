(function() {
	var sys = {
		appname: "dotplus",
		version: "0.1"
	};

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

	function get1DPos(x, y) {
		return y*env.canvasWidth + x;
	}

	function hslaToString(color) {
		if (!color) return "hsla(0, 0%, 0%, 0)";
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
			return;
		}
		return result;
	}

	function clone(src) {
		return $.extend(true, {}, src);
	}

	function loadSystem() {
		var load_key = sys.appname+".system";
		var load_data = loadJSON(load_key);
		if (!load_data) return;

		var loaded_filename = load_data.filename;
		if (loaded_filename === undefined || loaded_filename === "") return;

		var loaded_canvas_size = load_data.canvasSize;
		if (!loaded_canvas_size) return;

		var size_min = $("#createnew_size").attr("min");
		var size_max = $("#createnew_size").attr("max");
		loaded_canvas_size = Math.min(size_max, Math.max(size_min, loaded_canvas_size));

		$("#main_filename").val(loaded_filename);
		$("#createnew_size").val(loaded_canvas_size);

		return true;
	}

	function saveSystem() {
		var save_key = sys.appname+".system";
		var save_data = {};

		save_data.filename = $("#main_filename").val();
		save_data.canvasSize = $("#createnew_size").val();
		save_data.sysinfo = sys;

		saveJSON(save_key, save_data);

		return true;
	}

	function getFileList() {
		var result = [];
		var key, item;
		for (var i = localStorage.length; i--; ) {
			key = localStorage.key(i);
			if (!key) continue;

			var key_split = key.split(".");
			if (key_split[0] != sys.appname || key_split[1] != "files") continue;

			item = loadJSON(key);
			if (!item || !item.env) continue;
			result.push(item);
		}

		result.sort(function(a, b) {
			var timestamp_a = a.env.timestamp;
			var timestamp_b = b.env.timestamp;
			if (timestamp_a < timestamp_b) return 1;
			if (timestamp_a > timestamp_b) return -1;

			var filename_a = a.env.timestamp;
			var filename_b = b.env.timestamp;
			if (filename_a < filename_b) return -1;
			if (filename_a > filename_b) return 1;

			return 0;
		});

		return result;
	}

	function defaultData(width, height) {
		return {
			env: {
				filename: getAvailableFilename(),
				canvasWidth: width,
				canvasHeight: height,
				timestamp: "",
			},
			canvas: [{pixels: [], mask: []}],
			palette: [{colors: [{h:180, s:50, l:50, a:1}]}]
		};
	}

	function loadFile(name) {
		var load_data;
		if ((name === undefined) || (name === "")) {
			load_data = defaultData(env.canvasWidth, env.canvasHeight);
		} else {
			load_data = loadJSON(sys.appname+".files."+name);
		}

		if (!load_data) return;

		var loaded_env = load_data.env;
		var loaded_canvas = load_data.canvas;
		var loaded_palette = load_data.palette;

		// env
		if (!loaded_env) return;
		env = loaded_env;
		refreshEnv();
		$("#main_filename").val(env.filename);
		$("#main_filetimestamp").html(env.timestamp);

		// canvas
		if (!loaded_canvas || loaded_canvas.length < 1 || canvasControllers.length < 1) return;
		canvasControllers[0].pixels = loaded_canvas[0].pixels;
		canvasControllers[0].mask = loaded_canvas[0].mask;
		canvasControllers[0].render();

		// palette
		if (!loaded_palette) return;
		var color_manager = canvasControllers[0].colorManager;
		color_manager.colors = [];
		var color;
		for (var i = 0; i < loaded_palette[0].colors.length; i++) {
			color = loaded_palette[0].colors[i];
			if (!color) continue;
			color_manager.colors[i] = new Color(
				color.h,
				color.s,
				color.l,
				color.a
			);
		}
		color_manager.activateColor(0);
		color_manager.updatePaletteUI();

		return true;
	}

	var saved_revision = 0;
	function saveFile(name, rewrite) {
		if ((name === undefined) || (name === "")) return false;
		if (!historyManager.hasAnyChangeFrom(saved_revision)) return false;

		var save_key = sys.appname+".files."+name;
		if (!rewrite && loadFile(save_key)) {
			// file exists
			return false;
		}
		var save_data = {};

		// env
		env.timestamp = getTimestamp();
		env.filename = name;
		$("#main_filetimestamp").html(env.timestamp).addClass("saved");
		save_data.env = env;

		// canvas
		save_data.canvas = [];
		for (var i = 0; i < canvasControllers.length; i++) {
			save_data.canvas[i] = {
				caption: "layer",
				pixels: canvasControllers[i].pixels,
				mask: canvasControllers[i].mask
			};
		}

		save_data.palette = [];
		if (canvasControllers[0]) {
			save_data.palette[0] = {
				caption: "palette",
				colors: canvasControllers[0].colorManager.dumpColors()
			};
		}

		saveJSON(save_key, save_data);
		saved_revision = historyManager.counter;

		return true;
	}

	function removeFile(name) {
		if ((name === undefined) || (!loadFile(name))) return;

		var remove_key = sys.appname+".files."+name;
		localStorage.removeItem(remove_key);

		return true;
	}

	function getAvailableFilename() {
		var f = function() {
			return "notitle_" + zeroPadding(Math.round(Math.random() * 0xffffff).toString(16), 6);
		};
		var result = f();
		while (loadFile(result)) {
			result = f();
		}
		return result;
	}

	function showDialog(title, content, callback_ok, callback_cancel) {
		var elem_title = $("<div></div>", {
			"class": "dialog_title",
			html: title
		});
		var elem_content = $("<div></div>", {
			"class": "dialog_content",
			html: content
		});
		var element_button_cancel = $("<button></button>", {
			"class": "button_cancel",
			html: "Cancel"
		});
		element_button_cancel.on("click", function() {
			if (typeof(callback_cancel) === "function") {
				callback_cancel();
			}
			$(".overlay").fadeOut();
		});
		var element_button_ok = $("<button></button>", {
			"class": "button_ok",
			html: "OK"
		});
		element_button_ok.on("click", function() {
			if (typeof(callback_ok) === "function") {
				callback_ok();
			}
			$(".overlay").fadeOut();
		});

		$(".dialog").html("");
		if (title !== "") {
			$(".dialog").append(elem_title);
		}
		if (content !== "") {
			$(".dialog").append(elem_content);
		}
		if (typeof(callback_cancel) === "function") {
			$(".dialog").append(element_button_cancel);
		}
		if (typeof(callback_ok) === "function") {
			$(".dialog").append(element_button_ok);
		}

		$(".overlay").fadeIn();
	}

	function getTimestamp() {
		var now = new Date();

		return (
			[
				zeroPadding(now.getFullYear(), 4), "-",
				zeroPadding(now.getMonth(), 2), "-",
				zeroPadding(now.getDate(), 2), " ",
				zeroPadding(now.getHours(), 2), ":",
				zeroPadding(now.getMinutes(), 2), ":",
				zeroPadding(now.getSeconds(), 2)
			].join("")
		);
	}

	function zeroPadding(num, digit) {
		if (digit < 1) return;
		var zero_str = "";
		for (var i = digit; i--; ) {
			zero_str += "0";
		}
		return (zero_str + num).slice(-digit);
	}

	/* ======================================================================== */
	class HistoryManager {
		constructor() {
			this.history = [];
			this.pointer = -1;
			this.counter = 0;

			this.undo_animation_timer = undefined;
			this.redo_animation_timer = undefined;
		}

		hasAnyChangeFrom(counter) {
			return (counter !== this.counter);
		}

		takeHistory(caption) {
			var data = {
				pixels: canvasControllers[0].pixels,
				mask: canvasControllers[0].mask,
				palette: canvasControllers[0].colorManager.dumpColors()
			};

			while ((this.pointer < this.history.length-1) && this.history.length) {
				this.history.pop();
			}
			this.history.push({
				data: clone(data),
				caption: caption
			});
			this.pointer++;
			this.counter++;
			$("#main_filetimestamp").removeClass("saved");
		}

		update(history) {
			if (!history) return;

			canvasControllers[0].pixels = history.data.pixels;
			canvasControllers[0].mask = history.data.mask;

			var loaded_palette = history.data.palette;
			if (!loaded_palette) return;

			canvasControllers[0].colorManager.colors = [];
			var color;
			for (var i = 0; i < loaded_palette.length; i++) {
				color = loaded_palette[i];
				if (!color) continue;
				canvasControllers[0].colorManager.colors[i] = new Color(
					color.h,
					color.s,
					color.l,
					color.a
				);
			}

			canvasControllers[0].colorManager.updatePaletteUI();
			canvasControllers[0].render();
			this.counter++;
			$("#main_filetimestamp").removeClass("saved");
		}

		undo() {
			if (this.history.length <= 0) return;

			var p = -1;
			if (this.pointer > 0) {
				p = --this.pointer;
			}

			if (p < 0) return undefined;

			var history = clone(this.history[p]);
			this.update(history);

			// button animation
			$("#tool_undo").addClass("execute");
			if (this.undo_animation_timer) {
				clearTimeout(this.undo_animation_timer);
			}
			this.undo_animation_timer = setTimeout(function() {
				$("#tool_undo").removeClass("execute");
			}, 200);

			return true;
		}

		redo() {
			if (this.history.length <= 0) return;
			var p = this.history.length;
			if (this.pointer < this.history.length-1) {
				p = ++this.pointer;
			}

			if (p > this.history.length-1) return undefined;

			var history = clone(this.history[p]);
			this.update(history);

			// button animation
			$("#tool_redo").addClass("execute");
			if (this.redo_animation_timer) {
				clearTimeout(this.redo_animation_timer);
			}
			this.redo_animation_timer = setTimeout(function() {
				$("#tool_redo").removeClass("execute");
			}, 200);


			return true;
		}
	}

	/* ======================================================================== */
	class ShortcutKeyManager {
		constructor() {
			this.keyActionMap = [];

			var self = this;
			$(document).keydown(function(evt) {
				self.keyEventHandler(evt);
				// evt.preventDefault();
				// return false;
			});
		}

		keyToID(key) {
			var result = "";
			result += !isNaN(key.code) ? key.code : "?";
			result += key.shift ? "_1" : "_0";
			result += key.ctrl  ? "_1" : "_0";
			result += key.alt   ? "_1" : "_0";
			result += key.meta  ? "_1" : "_0";

			return result;
		}

		/**
		 * addShortcutKey
		 *
		 * @param key
		 *   {
		 *     code: <int>,
		 *     shift: <boolean>,
		 *     ctrl:  <boolean>,
		 *     alt:   <boolean>,
		 *     meta:  <boolean>
		 *   }
		 *
		 * @param action
		 *   callback function
		 */
		addShortcutKey(key, action) {
			var key_id = this.keyToID(key);
			this.keyActionMap[key_id] = action;
			return this;
		}

		addShortcutKeys(keys, action) {
			var result = true;
			for (var i = keys.length; i--; ) {
				result = this.addShortcutKey(keys[i], action);
				if (!result) return this;
			}
			return this;
		}

		keyEventHandler(evt) {
			if ($("#main_filename:focus").length) return;

			var key_id = this.keyToID({
				code: evt.keyCode,
				shift: evt.shiftKey,
				ctrl: evt.ctrlKey,
				alt: evt.altKey,
				meta: evt.metaKey
			});
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

		toString() {
			return hslaToString(this);
		}

		toJSON() {
			return {
				h: this.h,
				s: this.s,
				l: this.l,
				a: this.a
			};
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
		}

		dumpColors() {
			var result = [];
			var color;
			for (var i = 0; i < this.colors.length; i++) {
				color = this.colors[i];
				if (!color) continue;
				result[i] = color.toJSON();
			}
			return result;
		}

		updatePaletteUI() {
			for (var i = this.colorsIndexMax; i--; ) {
				var label = $("#color_"+i+" + label");
				if (this.colors[i]) {
					label.css("background-color", hslaToString(this.colors[i]));
					label.removeClass("has_no_color");
				} else {
					label.css("background-color", "");
					label.addClass("has_no_color");
				}
			}
			this.updateActiveColorUI();
		}

		randomColor() {
			var color = {};
			for (var i = this.colorsIndexMax; i--; ) {
				color = {
					h: Math.round(i/this.colorsIndexMax*360),
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
			this.updateActiveColorUI();
		}

		addCanvasController(canvas_controller) {
			this.canvasControllers.push(canvas_controller);
		}

		makePaletteUI() {
			// make color elements
			var style = $("<style></style>");
			var style_inner = "";
			for (var i = 0; i < this.colorsIndexMax; i++) {
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

				self.updateActiveColorUI();
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

			hue_ui.on("change", function() {
				historyManager.takeHistory("palette");
			});
			saturation_ui.on("change", function() {
				historyManager.takeHistory("palette");
			});
			lightness_ui.on("change", function() {
				historyManager.takeHistory("palette");
			});
		}

		addPenCallback(func, caller) {
			this.penCallbacks.push({
				func: func,
				caller: caller
			});
		}

		updateActiveColorUI() {
			for (var i = this.penCallbacks.length; i--; ) {
				var callback = this.penCallbacks[i];
				if (typeof(callback.func) == "function") {
					callback.func.apply(callback.caller);
				}
			}

			var index = this.getActiveColorIndex();
			if (index < 0) return;
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

			var label = $("#color_"+index+" + label");
			label.css("background-color", hslaToString(this.colors[index]));
			label.removeClass("has_no_color");
			this.updateActiveColorUI();
		}

		getColor(index) {
			if (index < 0 || index > this.colorsIndexMax) return;
			if (typeof(this.colors[index]) !== "object") {
				return;
			}
			return this.colors[index];
		}

		getActiveColor() {
			return this.getColor(this.getActiveColorIndex());
		}

		activateColor(index) {
			this.activeIndex = index;
			this.updateActiveColorUI();
		}

		getActiveColorIndex() {
			var index = this.activeIndex;
			if (index < 0 || index > this.colorsIndexMax) return -1;
			if (typeof(this.colors[index]) !== "object") return -1;
			return index;
		}
	}

	/* ======================================================================== */
	class CanvasController {
		constructor(context, colorManager) {
			this.context = context;
			this.colorManager = colorManager;
			//this.pixels = new Uint8Array(env.canvasWidth * env.canvasHeight);
			this.pixels = [];
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
			var pos = get1DPos(x, y);
			var index = this.colorManager.getActiveColorIndex();
			if (index < 0) return;

			if (this.mask[pos] && (this.pixels[pos] == index)) {
				return false;
			}

			this.pixels[pos] = index;
			this.mask[pos] = true;

			return true;
		}

		del(x, y) {
			var pos = get1DPos(x, y);

			if (!this.mask[pos]) return false;

			this.mask[pos] = false;

			return true;
		}

		fill(x, y) {
			var index, mask, pos, x_, y_, p_;
			var flag = [];
			var p = get1DPos(x, y);
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

			if (index < 0) return;
			if (source_mask && (source_index == fill_index)) {
				return false;
			}

			flag[p] = true;
			for (pos = queue.shift(); pos; pos = queue.shift()) {
				p = get1DPos(pos.x, pos.y);

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
					p_ = get1DPos(x_, y_);
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

			return true;
		}

		paste(rect, pixels, mask) {
			var result = false;
			var pos_src, pos_dst, x, y;

			for (var j = rect.height; j--; ) {
				for (var i = rect.width; i--; ) {
					x = rect.left + i;
					y = rect.top + j;

					if ((x >= env.canvasWidth) || (x < 0)) continue;
					if ((y >= env.canvasHeight) || (y < 0)) continue;

					pos_dst = get1DPos(x, y);
					pos_src = j*rect.width + i;

					if ((pos_dst >= env.canvasWidth*env.canvasHeight) || (pos_dst < 0)) continue;
					if ((pos_src >= rect.width*rect.height) || (pos_src < 0)) continue;

					if (mask[pos_src]) {
						if (!this.mask[pos_dst] || (this.pixels[pos_dst] != pixels[pos_src])) result = true;
						this.pixels[pos_dst] = pixels[pos_src];
						this.mask[pos_dst] = true;
					}
				}
			}
			this.render();

			return result;
		}

		activateColorAt(x, y) {
			var pos = get1DPos(x, y);
			if (!this.mask[pos]) return false;

			var index = this.pixels[pos];
			this.colorManager.activateColor(index);
			return true;
		}

		render(noguide) {
			var color, color_str, color_index;
			var screen_rect;
			var ctx = this.context;
			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
			for (var j = 0; j < env.canvasHeight; j++) {
				for (var i = 0; i < env.canvasWidth; i++) {
					var pos = get1DPos(i, j);
					color_index = this.pixels[pos];
					color = this.colorManager.getColor(color_index);
					screen_rect = c2s({
						x: i, y: j,
						w: 1, h: 1
					});
					if (color && this.mask[pos]) {
						// draw pixel
						ctx.fillStyle = hslaToString(color);
						ctx.fillRect(screen_rect.x, screen_rect.y, screen_rect.w, screen_rect.h);

						if (!noguide) {
							// draw hovered color indicator
							if (this.colorManager.hoveredIndex == color_index) {
								ctx.beginPath();
								ctx.fillStyle = hslaToString({
									h: color.h,
									s: color.s,
									l: (color.l > 50) ? 0 : 100,
									a: 0.2
								});
								ctx.arc(
									screen_rect.x + env.dotWidth/2,
									screen_rect.y + env.dotHeight/2,
									env.dotWidth/6,
									0, Math.PI*2, false
								);
								ctx.fill();
							}
						}
					}

					if (!noguide) {
						// draw grid
						if (i && j) {
							ctx.beginPath();
							ctx.fillStyle = hslaToString({
								h: 0,
								s: 0,
								l: (!color || !this.mask[pos] || color.l > 50) ? 0 : 100,
								a: 0.2
							});
							ctx.arc(
								screen_rect.x,
								screen_rect.y,
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

			var pos = get1DPos(x, y);
			var color = this.pixels[pos];
			var mask = this.mask[pos];
			var i, j, p;

			// left
			i = x;
			while (i-- > 0) {
				p = get1DPos(i, y);
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
				p = get1DPos(i, y);
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
				p = get1DPos(x, j);
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
				p = get1DPos(x, j);
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
				self.down = false;
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
				var pos = self.getRelativePos(evt);
				self.mousedownAction(pos);
			});

			this.canvasWrapper.on("mouseup", function(evt) {
				if (!self.isActive() || !self.down) return;
				self.down = false;
				var pos = self.getRelativePos(evt);
				self.mouseupAction(pos);
			});

			this.canvasWrapper.on("mouseleave", function(evt) {
				if (!self.isActive()) return;
				self.down = false;
				var pos = self.getRelativePos(evt);
				self.mouseleaveAction(pos);
			});

			this.canvasWrapper.on("mousemove", function(evt) {
				if (!self.isActive()) return;

				var pos = self.getRelativePos(evt);
				if (pos.x == pos_old.x && pos.y == pos_old.y) return;

				if (self.down) {
					self.mousemoveAction(pos);
				}

				self.moveCursor(pos.x, pos.y);
				pos_old = pos;
			});

			this.canvasWrapper.on("click", function(evt) {
				if (!self.isActive()) return;
				var pos = self.getRelativePos(evt);
				self.clickAction(pos);
			});

			$("body").on("click", function(evt) {
				if (!self.isActive()) return;
				var pos = self.getRelativePos(evt);
				self.globalClickAction(pos);
			});
		}

		isActive() {
			return this.button.is(":checked");
		}

		getRelativePos(evt) {
			var target_rect = evt.currentTarget.getBoundingClientRect();
			return s2c({
				x: evt.clientX - target_rect.left,
				y: evt.clientY - target_rect.top,
				w: 0, h: 0
			});
		}

		moveCursor(x, y) {
			var rect_canvas = {
				x: x, y: y,
				w: 1, h: 1
			};
			var rect_screen = c2s(rect_canvas);

			this.cursorNormal.css("left", rect_screen.x + "px");
			this.cursorNormal.css("top", rect_screen.y + "px");
			this.cursorNormal.css("width", rect_screen.w + "px");
			this.cursorNormal.css("height", rect_screen.h + "px");

			var canvas = canvasControllers[0];
			var pos = get1DPos(rect_canvas.x, rect_canvas.y);
			var color = canvas.colorManager.getColor(canvas.pixels[pos]);
			var darkback = false;
			var shadow_width = env.dotWidth/10;
			if (canvas.mask[pos] && color.l < 50) {
				darkback = true;
			}
			if (darkback) {
				this.cursorNormal.addClass("darkback");
				this.cursorNormal.css("box-shadow", "0 0 0 "+shadow_width+"px hsla(0, 0%, 100%, 0.3)");
			} else {
				this.cursorNormal.removeClass("darkback");
				this.cursorNormal.css("box-shadow", "0 0 0 "+shadow_width+"px hsla(0, 0%, 0%, 0.3)");
			}

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

			var indicator;

			var font_size = env.dotWidth/2;
			$(".distance_indicator").css("font-size", font_size+"px");

			// left
			indicator = this.cursorNormal.find(".distance_indicator.left");
			indicator.css("left", (- distance_screen_lt.x) + "px");
			indicator.css("top", "0");
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
			indicator.find(".number_text").attr("value", distance_canvas.bottom);
			if (distance_canvas.bottom > 0) {
				indicator.show();
			} else {
				indicator.hide();
			}
		}

		updateUI() {
			if (!this.isActive()) return;
			var color = canvasControllers[0].colorManager.getActiveColor();
			this.cursorNormal.css("background-color", hslaToString(color));
		}

		activateHandler() {
			this.cursorSelect.hide();
			this.updateUI();
		}

		mousedownAction(pos) {}
		mouseupAction(pos) {}
		mouseleaveAction(pos) {}
		mousemoveAction(pos) {}
		clickAction(pos) {}
		globalClickAction(pos) {}
	}

	/* ======================================================================== */
	class NormalPen extends Tool {
		constructor(button, canvas_wrapper, cursor_list) {
			super(button, canvas_wrapper, cursor_list);
			this.canvasChanged = false;
		}

		penAction(pos) {
			var canvas = canvasControllers[0];
			var changed = canvas.dot(pos.x, pos.y);
			if (changed) this.canvasChanged = true;
			canvas.render();
		}

		mousedownAction(pos) {
			this.canvasChanged = false;
			this.penAction(pos);
		}

		mousemoveAction(pos) {
			this.penAction(pos);
		}

		mouseupAction(pos) {
			var canvas = canvasControllers[0];
			if (this.canvasChanged) {
				historyManager.takeHistory("pen");
			}
		}
	}

	/* ======================================================================== */
	class Eraser extends Tool {
		constructor(button, canvas_wrapper, cursor_list) {
			super(button, canvas_wrapper, cursor_list);
			this.canvasChanged = false;
		}

		penAction(pos) {
			var canvas = canvasControllers[0];
			var changed = canvas.del(pos.x, pos.y);
			if (changed) this.canvasChanged = true;
			canvas.render();
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

		mousedownAction(pos) {
			this.canvasChanged = false;
			this.penAction(pos);
		}

		mousemoveAction(pos) {
			this.penAction(pos);
		}

		mouseupAction(pos) {
			var canvas = canvasControllers[0];
			if (this.canvasChanged) {
				historyManager.takeHistory("eraser");
			}
		}
	}

	/* ======================================================================== */
	class DropperPen extends Tool {
		constructor(button, canvas_wrapper, cursor_list) {
			super(button, canvas_wrapper, cursor_list);

			this.eraseMode = false;
			this.canvasChanged = false;
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

		dropperAction(pos) {
			this.hasColor = true;
			var canvas = canvasControllers[0];
			this.eraseMode = false;
			if (!canvas.activateColorAt(pos.x, pos.y)) {
				this.eraseMode = true;
			}
			this.updateUI();
		}

		penAction(pos) {
			var canvas = canvasControllers[0];
			var changed = false;
			if (this.eraseMode) {
				changed = canvas.del(pos.x, pos.y);
			} else {
				changed = canvas.dot(pos.x, pos.y);
			}
			if (changed) this.canvasChanged = true;
			canvas.render();

			this.initializeCursorUI();
			this.hasColor = false;
		}

		mousedownAction(pos) {
			this.canvasChanged = false;
			this.dropperAction(pos);
		}

		mouseupAction(pos) {
			this.penAction(pos);
			if (this.canvasChanged) {
				var canvas = canvasControllers[0];
				historyManager.takeHistory("dropper");
			}
		}

		activateHandler() {
			this.initializeCursorUI();
		}
	}

	/* ======================================================================== */
	class FillPen extends Tool {
		constructor(button, canvas_wrapper, cursor_list) {
			super(button, canvas_wrapper, cursor_list);
			this.canvasChanged = false;
		}

		penAction(pos) {
			var canvas = canvasControllers[0];
			var changed = canvas.fill(pos.x, pos.y);
			if (changed) this.canvasChanged = true;
			canvas.render();
		}

		clickAction(pos) {
			this.canvasChanged = false;
			this.penAction(pos);

			if (this.canvasChanged) {
				var canvas = canvasControllers[0];
				historyManager.takeHistory("fill");
			}
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
					var offset = {
						x: Math.min(self.beginPos.x, self.endPos.x),
						y: Math.min(self.beginPos.y, self.endPos.y)
					};
					var pos = self.getRelativePos(evt);
					self.moveCursor(pos.x + offset.x, pos.y + offset.y);
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

			//this.clipPixels = new Uint8Array(width * height);
			this.clipPixels = [];
			this.clipMask = [];
			var pos_src, pos_dst, x, y;
			for (var j = height; j--; ) {
				for (var i = width; i--; ) {
					x = left + i;
					y = top + j;
					if ((x >= env.canvasWidth) || (x < 0)) continue;
					if ((y >= env.canvasHeight) || (y < 0)) continue;

					pos_dst = j*width + i;
					pos_src = get1DPos(x, y);

					if ((pos_dst >= width*height) || (pos_dst < 0)) continue;
					if ((pos_src >= env.canvasWidth*env.canvasHeight) || (pos_src < 0)) continue;

					this.clipPixels[pos_dst] = canvasControllers[0].pixels[pos_src];
					this.clipMask[pos_dst] = canvasControllers[0].mask[pos_src];
				}
			}
		}

		pasteSelectedRect() {
			var canvas = canvasControllers[0];

			var rect = {
				left: Math.min(this.beginPos.x, this.endPos.x),
				top: Math.min(this.beginPos.y, this.endPos.y),
				width: Math.abs(this.beginPos.x - this.endPos.x) +1,
				height: Math.abs(this.beginPos.y - this.endPos.y) +1
			};
			if (canvas.paste(rect, this.clipPixels, this.clipMask)) {
				historyManager.takeHistory("selector");
			}
		}

		mousedownAction(pos) {
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

		mousemoveAction(pos) {
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

		mouseupAction(pos) {
			switch(this.getMode()) {
				case "moving":
				this.setMode("ready");
				this.pasteSelectedRect();
				break;

				default:
				this.setMode("ready");
				this.setSelectedPoint("end", pos, true);
				this.clipSelectedRect();
				this.updateSelectCanvas();
				break;
			}
			this.updateUI();
		}

		mouseleaveAction(pos) {
			switch(this.getMode()) {
				case "moving":
				this.setMode("ready");
				break;

				default:
				this.setMode("ready");
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
	class Finder {
		constructor(menu) {
			this.menu = menu;
			this.fileList = [];

			var self = this;
			menu.find("input[name='mainmenu_list']").on("change", function() {
				self.showFileList();
			});
		}

		showFileList() {
			var self = this;
			var file_list = getFileList();
			var file_list_elem = this.menu.find(".file_list");
			file_list_elem.html("");

			if (!file_list.length) {
				var caption = $("<div>");
				caption.html("<i class='icon-block'></i>");
				caption.addClass("nocontents");
				file_list_elem.append(caption);
				return;
			}

			for (var i = 0; i < file_list.length; i++) {
				var file = file_list[i];

				var li = $("<li>");
				li.attr("filename", file.env.filename);
				li.attr("timestamp", file.env.timestamp);
				if ($("#main_filename").val() == file.env.filename) {
					li.addClass("file_current");
				}

				var caption = $("<div>");
				caption.html(file.env.filename);
				caption.addClass("caption");

				var button_remove = $("<button>");
				button_remove.html("<i class='icon-trash'></i>");
				button_remove.addClass("button_remove");

				li.append(caption);
				li.append(button_remove);
				file_list_elem.append(li);
			}

			file_list_elem.find("li").on("click", function() {
				var filename = $(this).attr("filename");
				if (loadFile(filename)) {
					$(".file_current").removeClass("file_current");
					$(this).addClass("file_current");
					historyManager = new HistoryManager();
					historyManager.takeHistory("init");
				}
			});

			file_list_elem.find(".button_remove").on("click", function(evt) {
				var filename = $(this).parent().attr("filename");
				showDialog("remove '"+filename+"' ?", "", function() {
					removeFile(filename);
					self.showFileList();
				}, function() {});
				evt.stopPropagation();
				return false;
			});
		}
	}

	/* ======================================================================== */
	$(document).ready(function() {
		// env
		refreshEnv();
		var resize_timer;
		$(window).resize(function() {
			if (resize_timer) {
				clearTimeout(resize_timer);
				resize_timer = undefined;
			}
			resize_timer = setTimeout(refreshEnv, 100);
		});

		var main_filename = $("#main_filename");

		var save_timer;
		$(window).on("keyup mouseup", function() {
			// does not need to save
			if (historyManager.history.length <= 1) return;

			if (save_timer) {
				clearTimeout(save_timer);
				save_timer = undefined;
			}
			save_timer = setTimeout(function() {
				// changing filename
				if ($("input:focus").length) return;

				saveFile(main_filename.val());
				saveSystem();
			}, 1000);
			return true;
		});

		historyManager = new HistoryManager();

		var colorManager = new ColorManager($(".palette_ui"), $(".color_selector"));

		// canvas
		canvasControllers.push(new CanvasController(
			$("#canvas_main")[0].getContext("2d"),
			colorManager
		));

		loadSystem();
		loadFile(main_filename.val());

		// history
		historyManager.takeHistory("init");

		// tools
		var cursor_list = {
			normal: $(".cursor_normal"),
			select: $(".cursor_select")
		};
		new NormalPen($("#tool_pen"), $(".canvas_wrapper"), cursor_list);
		new Eraser($("#tool_eraser"), $(".canvas_wrapper"), cursor_list);
		new DropperPen($("#tool_dpen"), $(".canvas_wrapper"), cursor_list);
		new FillPen($("#tool_fill"), $(".canvas_wrapper"), cursor_list);
		new Selector($("#tool_selector"), $(".canvas_wrapper"), cursor_list);
		$("#tool_undo").on("click", function() {
			historyManager.undo();
		});
		$("#tool_redo").on("click", function() {
			historyManager.redo();
		});

		// shortcut key
		var shortcutKeyManager = new ShortcutKeyManager();
		shortcutKeyManager.addShortcutKey( // Pen
			{ code: 70 }, // f
			function() {
				$("#tool_pen").prop("checked", true).change();
			}
		).addShortcutKey( // Eraser
			{ code: 68 }, // d
			function() {
				$("#tool_eraser").prop("checked", true).change();
			}
		).addShortcutKey( // Dropper
			{ code: 83 }, // s
			function() {
				$("#tool_dpen").prop("checked", true).change();
			}
		).addShortcutKey( // Fill
			{ code: 65 }, // a
			function() {
				$("#tool_fill").prop("checked", true).change();
			}
		).addShortcutKey( // Select
			{ code: 86 }, // v
			function() {
				$("#tool_selector").prop("checked", true).change();
			}
		).addShortcutKeys( // Undo
			[
				{ code: 90 }, // z
				{ code: 90, ctrl: true }, // ctrl + z
				{ code: 90, meta: true }, // meta + z
			],
			function() {
				historyManager.undo();
			}
		).addShortcutKeys( // Redo
			[
				{ code: 88 }, // x
				{ code: 90, ctrl: true, shift: true }, // ctrl + shift + z
				{ code: 90, meta: true, shift: true} // meta + shift + z
			],
			function() {
				historyManager.redo();
			}
		);

		// UIs
		if (main_filename.val() === "") {
			main_filename.val(getAvailableFilename());
		}
		main_filename.on("keydown", function(evt) {
			if (evt.originalEvent.keyCode == 13) {
				// Enter
				$(this).blur();
			}
		});
		main_filename.on("blur", function() {
			if (env.filename !== main_filename.val()) {
				historyManager.counter++;
			}
			saveFile(main_filename.val());
			saveSystem();
		});

		$(".main_toggle_button").on("click", function() {
			var targets = $(this).attr("targets").split(" ");
			if (!targets || !targets.length) return;

			var index = $(this).attr("index");
			if (index === undefined) {
				index = 0;
			}

			index++;
			if ((index < 0) || (index >= targets.length)) {
				index = 0;
			}

			for (var i = targets.length; i--; ) {
				if (i == index) {
					$("."+targets[i]).show();
				} else {
					$("."+targets[i]).hide();
				}
			}

			$(this).attr("index", index);
		});

		// dialogs
		$(".overlay").on("click", function() {
			$(this).fadeOut();
		});
		$(".dialog").on("click", function() {
			return false;
		});

		// mainmenu
		$("#createnew_caption").on("change", function() {
			$("#createnew_size").focus();
		});
		$("#createnew_ok").on("click", function() {
			// save current file
			if (main_filename.val() === "") {
				main_filename.val(getAvailableFilename());
			}
			saveFile(main_filename.val());

			var size = $("#createnew_size").val();
			var size_min = $("#createnew_size").attr("min");
			var size_max = $("#createnew_size").attr("max");
			size = Math.min(size_max, Math.max(size_min, size));
			$("#createnew_size").val(size);

			env.canvasWidth = size;
			env.canvasHeight = size;
			loadFile(undefined);
		});

		$("#download_png").on("click", function() {
			var size = $("#download_size").val();
			if (!size || (size <= 0)) {
				return;
			}

			var src_width = env.screenWidth;
			var src_height = env.screenHeight;
			var dst_width = size;
			var dst_height = size;

			var canvas_dst_ = $("<canvas></canvas>");
			canvas_dst_.attr("width", dst_width);
			canvas_dst_.attr("height", dst_height);
			var canvas_dst = canvas_dst_[0];

			canvasControllers[0].render(true);

			var canvas_src = canvasControllers[0].context.canvas;
			var context_dst = canvas_dst.getContext("2d");
			var context_src = canvasControllers[0].context;

			var image = context_src.getImageData(0, 0, src_width, src_height);
			//context_dst.putImageData(image, 0, 0);
			context_dst.drawImage(canvas_src, 0, 0, src_width, src_height, 0, 0, dst_width, dst_height);

			var href = canvas_dst.toDataURL("image/png");
			window.open(href, "_blank");

			canvasControllers[0].render();
			return false;
		});

		var finder = new Finder($("#mainmenu_finder"));
	});

	// disable contextmenu
	$(document).on("contextmenu", function(evt) {
		evt.preventDefault();
	});
})();
