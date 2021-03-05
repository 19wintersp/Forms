const { promises: fs, readFileSync } = require("fs");
const crypto = require("crypto");
const path = require("path");
const express = require("express");
const helmet = require("helmet");

const ready = { };
ready.promise = new Promise((res) => {
	ready.ready = res;	
});

try {
	const config = readFileSync(process.env.CONFIG || "config.json");
	config = JSON.parse(config);
	Object.assign(process.env, config);
} catch { }

const PORT = process.env.HTTP_PORT || 8080;
const VIEWS = path.join(__dirname, process.env.VIEWS_DIR || "views");
const STATIC = path.join(__dirname, process.env.STATIC_DIR || "static");
const DATA = path.join(__dirname, process.env.DATA_DIR || "data");
const CUSTOM = path.join(__dirname, process.env.CUSTOM_DIR || "custom")
const TITLE = process.env.TITLE || "Forms";

const hash = (data) => crypto
	.createHash("sha256")
	.update(data)
	.digest();
const btoa = (data) => Buffer
	.from(data)
	.toString("base64")
	.replace(/\+/g, "-")
	.replace(/\//g, "_")
	.replace(/\=/g, "*");
const atob = (data) => Buffer
	.from(
		data
			.replace(/\-/g, "+")
			.replace(/\_/g, "/")
			.replace(/\*/g, "="),
		"base64"
	);

const forms = new Map();
const pages = new Map();
const tokens = new Map();

Promise
	.all([
		fs.stat(DATA).catch(() => fs.mkdir(DATA)),
		fs.stat(CUSTOM).catch(() => fs.mkdir(CUSTOM)),
	])
	.then(() => Promise
		.all([
			fs.readdir(DATA),
			fs.readdir(CUSTOM)
		])
		.then(([ dataFiles, customFiles ]) => {
			Promise
				.all([
					Promise
						.all(dataFiles.map((file) => fs.readFile(path.join(DATA, file))))
						.then((fileData) => {
							fileData.map(JSON.parse).forEach((form, index) => {
								forms.set(dataFiles[index], form);
							});
						}),
					Promise
						.all(customFiles.map((file) => fs.readFile(path.join(CUSTOM, file))))
						.then((fileData) => {
							fileData.map(JSON.parse).forEach((page, index) => {
								pages.set(customFiles[index], page);
							});
						})
				])
				.then(() => {
					ready.ready()
				});
		})
	);

const app = express()
	.set("view engine", "ejs")
	.set("views", VIEWS)
	.use(
		helmet({
			contentSecurityPolicy: {
				directives: {
					...helmet.contentSecurityPolicy.getDefaultDirectives(),
					"script-src": ["'self'", "'unsafe-eval'"]
				}
			}
		})
	)
	.use("/static", express.static(STATIC))
	.use(express.json())
	.use(express.urlencoded({ extended: false }))
	.use((req, res, next) => ready.promise.then(next))
	.use((req, res, next) => {
		console.info(`${ req.method } ${ req.path } (${ Object.keys(req.query).length } query parameters)`);

		next();
	})
	.use((err, req, res, next) => {
		console.error(`ERROR: ${ err }`);
		res.status(500).render("error.ejs", {
			TITLE,
			code: 500,
			error: err
		});

		next();
	})
	.get("/", (req, res) => {
		res.status(200).render("launch.ejs", {
			TITLE
		});
	})
	.post("/", async (req, res) => { //create form
		if (!(req.body.title && req.body.author)) {
			res.status(400).render("error.ejs", {
				TITLE,
				code: 400,
				error: "Fields missing"
			});

			return;
		}

		let id = btoa(crypto.randomBytes(6));
		const key = btoa(crypto.randomBytes(9));

		while (forms.has(id)) id = btoa(crypto.randomBytes(6));

		const data = {
			code: id,
			key: btoa(hash(atob(key))),
			title: req.body.title,
			author: req.body.author,
			sections: [],
			responses: []
		};

		forms.set(id, data);
		await fs.writeFile(path.join(DATA, id), JSON.stringify(data));

		res.status(303).redirect(`/edit/${ id }?key=${ key }&new=1`);
	})
	.get("/favicon.ico", (req, res) => res.redirect("/static/favicon.png"))
	.get("/pages", (req, res) => {
		res.status(200).render("index.ejs", {
			TITLE,
			pages: Object.fromEntries(pages.entries())
		});
	})
	.get("/pages/:name", (req, res) => {
		if (!pages.has(req.params.name)) {
			res.status(404).render("error.ejs", {
				TITLE,
				code: 404,
				error: "Page not found"
			});
		} else {
			res.status(200).render("custom.ejs", {
				TITLE,
				data: pages.get(req.params.name)
			});
		}
	})
	.get("/view", (req, res) => {
		if (req.query.id) {
			const qs = Object
				.keys(req.query)
				.map((param) => `${ param }=${ req.query[param] }`)
				.join("&");

			res.redirect(`/view/${ req.query.id }?${ qs }`);
		} else {
			res.redirect("/");
		}
	})
	.use("/view/:id", (req, res, next) => {
		if (!forms.has(req.params.id)) {
			res.status(404).render("error.ejs", {
				TITLE,
				code: 404,
				error: "Form not found"
			});
		} else {
			req.form = forms.get(req.params.id);
			next();
		}
	})
	.get("/view/:id", (req, res) => { //get form
		res.status(200).render("form.ejs", {
			TITLE,
			code: req.form.code,
			meta: {
				title: req.form.title,
				author: req.form.author
			},
			sections: req.form.sections
		});
	})
	.post("/view/:id", async (req, res) => { //submit form
		req.form.responses.push(req.body);
		forms.set(req.params.id, Object.assign({}, req.form));

		const data = JSON.stringify(forms.get(req.params.id));
		await fs.writeFile(path.join(DATA, req.params.id), data);

		res.status(200).render("success.ejs", {
			TITLE,
			message: "Your response has been recorded"
		});
	})
	.get("/edit", (req, res) => {
		if (req.query.id) {
			const qs = Object
				.keys(req.query)
				.map((param) => `${ param }=${ req.query[param] }`)
				.join("&");

			res.redirect(`/edit/${ req.query.id }?${ qs }`);
		} else {
			res.redirect("/");
		}
	})
	.use("/edit/:id", (req, res, next) => {
		if (!forms.has(req.params.id)) {
			res.status(404).render("error.ejs", {
				TITLE,
				code: 404,
				error: "Form not found"
			});
		} else {
			const form = forms.get(req.params.id);

			const key = atob(req.query.key || "");
			if (btoa(hash(key)) != form.key) {
				res.status(403).render("error.ejs", {
					TITLE,
					code: 403,
					error: req.query.key
						? "Invalid admin key"
						: "Missing admin key"
				});
			} else {
				req.form = form;
				next();
			}
		}
	})
	.get("/edit/:id", (req, res) => { //get editor
		res.status(200).render("edit.ejs", {
			TITLE,
			newForm: !!req.query.new,
			code: req.form.code,
			key: req.query.key,
			meta: {
				title: req.form.title,
				author: req.form.author
			},
			sections: req.form.sections,
			responses: req.form.responses
		});
	})
	.patch("/edit/:id", async (req, res) => { //update form
		const allowed = [ "title", "author", "sections" ];
		const newData = Object
			.fromEntries(
				Object
					.entries(req.body)
					.filter((pair) => allowed.includes(pair[0]))
			);

		const data = Object.assign({}, req.form);
		Object.assign(data, newData);

		forms.set(req.params.id, data);
		await fs.writeFile(path.join(DATA, req.params.id), JSON.stringify(data));

		res.status(204).send("");
	})
	.delete("/edit/:id", async (req, res) => { //delete form
		forms.delete(req.params.id);
		await fs.unlink(path.join(DATA, req.params.id));

		res.status(204).send("");
	})
	.get("/data", (req, res) => {
		if (req.query.id) {
			const qs = Object
				.keys(req.query)
				.map((param) => `${ param }=${ req.query[param] }`)
				.join("&");

			res.redirect(`/data/${ req.query.id }?${ qs }`);
		} else {
			res.redirect("/");
		}
	})
	.use("/data/:id", (req, res, next) => {
		if (!forms.has(req.params.id)) {
			res.status(404).render("error.ejs", {
				TITLE,
				code: 404,
				error: "Form not found"
			});
		} else {
			req.form = forms.get(req.params.id);
			next();
		}
	})
	.get("/data/:id", (req, res) => {
		const formData = {
			code: req.form.code,
			meta: {
				title: req.form.title,
				author: req.form.author
			},
			sections: req.form.sections
		};

		const key = atob(req.query.key || "");
		if (btoa(hash(key)) == req.form.key) {
			Object.assign(formData, {
				responses: req.form.responses
			});
		} else if (req.query.key) {
			res.status(401).render("error.ejs", {
				TITLE,
				code: 401,
				error: "Invalid admin key"
			});

			return;
		}

		res.json(formData);
	})
	.all("*", (req, res) => {
		console.warn(`NOT FOUND: ${ req.method } ${ req.originalUrl }`);
		res.status(404).render("error.ejs", {
			TITLE,
			code: 404,
			error: "Resource not found"
		});
	})
	.listen(PORT, () => console.log(`Listening on ${ PORT }.`));

console.clear();
