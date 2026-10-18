const mapaSvg = document.querySelector('#mapa-estelar');
const datosCielo = window.mapaCelesteDatos;
const cuerpo = document.body;
const elementoNombre = document.querySelector('#nombre-detalle');
const elementoUbicacion = document.querySelector('#ubicacion-detalle');
const listaEstrellas = document.querySelector('#estrellas-detalle');
const formularioBusqueda = document.querySelector('#busqueda-celeste');
const campoBusqueda = document.querySelector('#buscar-estrella');
const resultadoBusqueda = document.querySelector('#resultado-busqueda');
const listaSugerencias = document.querySelector('#sugerencias-celestes');
const vistaCompleta = { x: 0, y: 0, width: 1440, height: 700 };
const zoomMinimo = 1;
const zoomMaximo = 8;
let vistaActual = { ...vistaCompleta };
const svgNamespace = 'http://www.w3.org/2000/svg';
const constelacionesPorId = new Map((datosCielo?.constelaciones || []).map((constelacion) => [constelacion.id, constelacion]));
const estrellasPorHip = new Map((datosCielo?.estrellas || []).map((estrella) => {
	const [x, y, , color, , nombre, designacion, magnitud, hip, proper] = estrella;
	const ra = ((360 - ((x - 40) / 1360 * 360)) % 360 + 360) % 360;
	const dec = 90 - (y - 40) / 620 * 180;
	return [hip, {
		id: hip,
		name: nombre,
		proper,
		designation: designacion,
		mag: magnitud,
		color,
		ra,
		dec
	}];
}));

function crearElementoSvg(nombre, atributos = {}) {
	const elemento = document.createElementNS(svgNamespace, nombre);
	Object.entries(atributos).forEach(([clave, valor]) => {
		elemento.setAttribute(clave, valor);
	});
	return elemento;
}

function ascensionRecta(ra) {
	const horas = (ra / 15) % 24;
	const hora = Math.floor(horas);
	const minutos = Math.floor((horas - hora) * 60);
	return `${String(hora).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}m`;
}

function declinacion(dec) {
	return `${dec >= 0 ? '+' : ''}${dec.toFixed(1)}°`;
}

function normalizarTexto(texto) {
	return texto
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLocaleLowerCase('es')
		.trim();
}

function crearIndiceBusqueda() {
	const estrellas = datosCielo.estrellas.map((estrella) => {
		const [, , , , id, nombre, designacion, magnitud, hip, nombrePropio, personaje, destino] = estrella;
		const constelacion = constelacionesPorId.get(id);
		return {
			tipo: 'estrella',
			nombre,
			designacion,
			nombrePropio,
			personaje,
			destino,
			magnitud,
			hip,
			x: estrella[0],
			y: estrella[1],
			id,
			constelacion,
			termino: normalizarTexto([
				nombre, designacion, nombrePropio, personaje, id,
				constelacion?.name, constelacion?.latin
			].filter(Boolean).join(' '))
		};
	});
	const constelaciones = datosCielo.constelaciones.map((constelacion) => ({
		tipo: 'constelacion',
		nombre: constelacion.name,
		id: constelacion.id,
		constelacion,
		x: constelacion.center[0],
		y: constelacion.center[1],
		termino: normalizarTexto(`${constelacion.name} ${constelacion.latin} ${constelacion.id}`)
	}));
	return { estrellas, constelaciones };
}

const indiceBusqueda = crearIndiceBusqueda();

function seleccionarConstelacion(constelacion, estrellaElegida) {
	if (!constelacion || !elementoNombre || !elementoUbicacion || !listaEstrellas) return;

	mapaSvg.querySelectorAll('.constelacion-mapa').forEach((elemento) => {
		elemento.classList.toggle('seleccionada', elemento.dataset.constellationId === constelacion.id);
	});
	mapaSvg.querySelectorAll('.personaje-celeste').forEach((elemento) => {
		elemento.classList.toggle('personaje-seleccionado', elemento.dataset.constellationId === constelacion.id);
	});

	elementoNombre.textContent = estrellaElegida
		? `${estrellaElegida.name} · ${constelacion.name}`
		: constelacion.name;
	elementoUbicacion.textContent = `${constelacion.hemisphere} · AR ${ascensionRecta(constelacion.ra)} · Dec ${declinacion(constelacion.dec)}`;
	listaEstrellas.replaceChildren();

	const estrellas = estrellaElegida
		? [estrellaElegida, ...constelacion.stars.filter((estrella) => estrella.id !== estrellaElegida.id)]
		: constelacion.stars;
	estrellas.forEach((estrella) => {
		const elemento = document.createElement('li');
		const muestra = document.createElement('span');
		const descripcion = document.createElement('span');
		muestra.className = 'muestra-color';
		muestra.style.backgroundColor = estrella.color;
		muestra.style.color = estrella.color;
		muestra.setAttribute('aria-hidden', 'true');

		const nombre = estrella.proper
			? `${estrella.name} · ${estrella.designation}`
			: estrella.name;
		const coordenadas = `AR ${ascensionRecta(estrella.ra)} · Dec ${declinacion(estrella.dec)}`;
		const magnitud = Number.isFinite(estrella.mag) ? ` · magnitud ${estrella.mag.toFixed(2)}` : '';
		descripcion.textContent = `${nombre} · ${coordenadas}${magnitud}`;
		elemento.append(muestra, descripcion);
		listaEstrellas.append(elemento);
	});
}

function ubicarNombre(nombre, centro, anchura, posiciones) {
	const distancia = Math.max(24, Math.min(112, anchura * 0.72));
	const alternativas = [
		[0, 0], [distancia, 0], [-distancia, 0], [0, 20], [0, -20],
		[distancia, 20], [-distancia, 20], [distancia, -20], [-distancia, -20],
		[distancia * 1.6, 0], [-distancia * 1.6, 0], [0, 40], [0, -40],
		[distancia * 1.4, 40], [-distancia * 1.4, 40], [distancia * 1.4, -40], [-distancia * 1.4, -40],
		[distancia * 2.2, 0], [-distancia * 2.2, 0], [0, 60], [0, -60]
	];
	const semiancho = Math.max(16, anchura / 2);

	for (const [dx, dy] of alternativas) {
		const x = Math.max(45 + semiancho, Math.min(1395 - semiancho, centro[0] + dx));
		const y = Math.max(34, Math.min(671, centro[1] + dy));
		const colision = posiciones.some((posicion) => (
			Math.abs(x - posicion.x) < semiancho + posicion.ancho + 4
			&& Math.abs(y - posicion.y) < 17
		));
		if (!colision) {
			posiciones.push({ x, y, ancho: semiancho });
			return [x, y];
		}
	}

	return [centro[0], centro[1]];
}

function dibujarMapa() {
	if (!mapaSvg || !datosCielo) return;

	const capaFondo = crearElementoSvg('g', { class: 'estrellas-fondo', 'aria-hidden': 'true' });
	const capaConstelaciones = crearElementoSvg('g', { class: 'constelaciones-mapa' });
	mapaSvg.append(capaFondo, capaConstelaciones);

	const componentes = new Map(datosCielo.constelaciones.map((constelacion) => [constelacion.id, []]));

	datosCielo.estrellas.forEach((estrella) => {
		const [, , radio, color, id, nombre, designacion, magnitud, hip] = estrella;
		if (!constelacionesPorId.has(id)) return;
		componentes.get(id).push(estrella);
		if (magnitud > 5) return;

		const punto = crearElementoSvg('circle', {
			cx: estrella[0],
			cy: estrella[1],
			r: radio,
			fill: color,
			color,
			style: `--luminosidad:${Math.max(0.42, Math.min(0.95, 1 - magnitud * 0.075))}`,
			'data-constellation-id': id,
			'data-star-name': nombre,
			'data-star-hip': hip
		});
		const detalle = crearElementoSvg('title');
		detalle.textContent = `${nombre}${designacion ? ` · ${designacion}` : ''} · HIP ${hip}`;
		punto.append(detalle);
		capaFondo.append(punto);
	});

	const posicionesNombres = [];
	const estrellasDestacadas = new Map();
	for (const constelacion of datosCielo.constelaciones) {
		const grupo = crearElementoSvg('g', {
			class: 'constelacion-mapa',
			'data-constellation-id': constelacion.id,
			tabindex: '0',
			role: 'group',
			'aria-label': `${constelacion.name}: ${constelacion.hemisphere}, ascensión recta ${ascensionRecta(constelacion.ra)}, declinación ${declinacion(constelacion.dec)}`
		});
		const grupoTrazos = crearElementoSvg('g', { class: 'trazos-constelacion' });
		grupo.append(grupoTrazos);

		constelacion.lines.forEach((linea) => {
			const puntos = linea.map(([x, y], indice) => `${indice === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
			grupoTrazos.append(crearElementoSvg('path', { d: puntos, class: 'lineas-constelacion' }));
		});

		const estrellasClave = constelacion.stars
			.map((estrella) => componentes.get(constelacion.id).find((componente) => componente[8] === estrella.id))
			.filter(Boolean);
		estrellasClave.forEach((estrella) => {
			const [, , radio, color, , nombre, designacion, , hip, , personaje, destino] = estrella;
			const grupoEstrella = crearElementoSvg('g', {
				class: `estrella-destacada-mapa${personaje ? ' personaje-celeste' : ''}`,
				'data-constellation-id': constelacion.id
			});
			if (personaje) {
				grupoEstrella.append(crearElementoSvg('circle', {
					cx: estrella[0],
					cy: estrella[1],
					r: 56,
					class: 'objetivo-tactil'
				}));
			}
			const circulo = crearElementoSvg('circle', {
				cx: estrella[0],
				cy: estrella[1],
				r: Math.max(1.5, radio + 0.35),
				fill: color,
				color,
				'data-star-name': nombre,
				'data-constellation-id': constelacion.id,
				'data-star-hip': hip
			});
			const etiqueta = crearElementoSvg('title');
			etiqueta.textContent = `${nombre}${designacion ? ` · ${designacion}` : ''}`;
			circulo.append(etiqueta);
			grupoEstrella.append(circulo);
			if (personaje && destino) {
				const enlace = crearElementoSvg('a', {
					href: destino,
					'aria-label': `${personaje}, estrella ${nombre} de ${constelacion.name}`
				});
				enlace.append(grupoEstrella);
				grupo.append(enlace);
				const etiquetaPersonaje = crearElementoSvg('text', {
					class: 'nombre-estrella-mapa nombre-estrella-personaje',
					x: estrella[0] + 16,
					y: estrella[1] - 12
				});
				etiquetaPersonaje.textContent = nombre;
				grupo.append(etiquetaPersonaje);
			} else {
				grupo.append(grupoEstrella);
			}
			estrellasDestacadas.set(`${constelacion.id}:${hip}`, { estrella, radio });
		});

		capaConstelaciones.append(grupo);
	}

	for (const constelacion of datosCielo.constelaciones) {
		const grupo = capaConstelaciones.querySelector(`[data-constellation-id="${constelacion.id}"]`);
		if (!grupo) continue;

		const principal = constelacion.stars[0];
		const puntoPrincipal = principal && estrellasDestacadas.get(`${constelacion.id}:${principal.id}`);
		if (principal && puntoPrincipal) {
			const [x, y] = calcularPunto(principal.ra, principal.dec);
			const etiquetaEstrella = crearElementoSvg('text', {
				class: 'nombre-estrella-mapa',
				'text-anchor': 'middle'
			});
			const [labelX, labelY] = ubicarNombre(
				principal.name,
				[x + Math.max(9, puntoPrincipal.radio + 8), y - 6],
				principal.name.length * 6,
				posicionesNombres
			);
			etiquetaEstrella.setAttribute('x', labelX);
			etiquetaEstrella.setAttribute('y', labelY);
			etiquetaEstrella.textContent = principal.name;
			grupo.append(etiquetaEstrella);
		}

		const etiquetaNombre = crearElementoSvg('text', {
			class: 'nombre-constelacion-mapa',
			'text-anchor': 'middle'
		});
		etiquetaNombre.textContent = constelacion.name;
		const [labelX, labelY] = ubicarNombre(
			constelacion.name,
			constelacion.center,
			constelacion.name.length * 6,
			posicionesNombres
		);
		etiquetaNombre.setAttribute('x', labelX);
		etiquetaNombre.setAttribute('y', labelY);
		grupo.append(etiquetaNombre);
	}

	const constelacionInicial = datosCielo.constelaciones.find((constelacion) => constelacion.id === 'Ori');
	if (constelacionInicial) {
		const estrellaBetelgeuse = constelacionInicial.stars.find((estrella) => estrella.name === 'Betelgeuse');
		seleccionarConstelacion(constelacionInicial, estrellaBetelgeuse);
	}
}

function calcularPunto(ra, dec) {
	return [
		40 + (360 - ((ra % 360) + 360) % 360) / 360 * 1360,
		40 + (90 - dec) / 180 * 620
	];
}

dibujarMapa();

if (mapaSvg) {
	function actualizarVista(x, y, width, height) {
		const margenX = width * 0.12;
		const margenY = height * 0.12;
		const vistaMaximaX = vistaCompleta.width - width + margenX;
		const vistaMaximaY = vistaCompleta.height - height + margenY;
		vistaActual = {
			x: Math.max(-margenX, Math.min(vistaMaximaX, x)),
			y: Math.max(-margenY, Math.min(vistaMaximaY, y)),
			width,
			height
		};
		mapaSvg.setAttribute('viewBox', `${vistaActual.x} ${vistaActual.y} ${width} ${height}`);
		const zoom = vistaCompleta.width / width;
		mapaSvg.classList.toggle('mapa-ampliado', zoom >= 4.5);
		mapaSvg.classList.toggle('mapa-detallado', zoom >= 4.8);

		const coordenadasMapa = document.querySelector('#coordenadas-mapa');
		if (width >= vistaCompleta.width * 0.95) {
			coordenadasMapa.textContent = 'AR 00h–24h · Dec +90° a −90° · Coordenadas aproximadas (J2000)';
		} else {
			const raInicio = ((360 - vistaActual.x / vistaCompleta.width * 360) % 360 + 360) % 360;
			const raFin = ((360 - (vistaActual.x + width) / vistaCompleta.width * 360) % 360 + 360) % 360;
			const decNorte = 90 - vistaActual.y / vistaCompleta.height * 180;
			const decSur = 90 - (vistaActual.y + height) / vistaCompleta.height * 180;
			coordenadasMapa.textContent =
				`AR ${ascensionRecta(raInicio)}–${ascensionRecta(raFin)} · Dec ${declinacion(decNorte)}–${declinacion(decSur)} · Coordenadas aproximadas (J2000)`;
		}
	}

	function ampliar(factor, centro) {
		const zoomActual = vistaCompleta.width / vistaActual.width;
		const zoomSiguiente = Math.max(zoomMinimo, Math.min(zoomMaximo, zoomActual * factor));
		const escala = zoomActual / zoomSiguiente;
		const width = vistaCompleta.width / zoomSiguiente;
		const height = vistaCompleta.height / zoomSiguiente;
		const centroX = centro?.x ?? vistaActual.x + vistaActual.width / 2;
		const centroY = centro?.y ?? vistaActual.y + vistaActual.height / 2;
		const x = centroX - (centroX - vistaActual.x) * escala;
		const y = centroY - (centroY - vistaActual.y) * escala;
		actualizarVista(x, y, width, height);
	}

	function centrarCoordenada(x, y, zoom = 3.5) {
		const zoomSiguiente = Math.max(zoomMinimo, Math.min(zoomMaximo, zoom));
		const width = vistaCompleta.width / zoomSiguiente;
		const height = vistaCompleta.height / zoomSiguiente;
		actualizarVista(x - width / 2, y - height / 2, width, height);
	}

	function buscarCoincidencias(consulta) {
		const termino = normalizarTexto(consulta);
		if (!termino) return [];
		const estrellas = indiceBusqueda.estrellas
			.filter((estrella) => estrella.termino.includes(termino))
			.sort((a, b) => {
				const aExacto = normalizarTexto(a.nombre) === termino || normalizarTexto(a.personaje || '') === termino;
				const bExacto = normalizarTexto(b.nombre) === termino || normalizarTexto(b.personaje || '') === termino;
				return Number(bExacto) - Number(aExacto) || a.magnitud - b.magnitud;
			});
		const constelaciones = indiceBusqueda.constelaciones
			.filter((constelacion) => constelacion.termino.includes(termino));
		return [...constelaciones, ...estrellas].slice(0, 7);
	}

	function mostrarSugerencias(resultados) {
		if (!listaSugerencias) return;
		listaSugerencias.replaceChildren();
		resultados.forEach((resultado) => {
			const elemento = document.createElement('li');
			const boton = document.createElement('button');
			boton.type = 'button';
			boton.textContent = resultado.tipo === 'estrella'
				? `${resultado.personaje ? `${resultado.personaje} · ` : ''}${resultado.nombre} · ${resultado.constelacion.name}`
				: resultado.nombre;
			boton.addEventListener('click', () => enfocarResultado(resultado));
			elemento.append(boton);
			listaSugerencias.append(elemento);
		});
	}

	function enfocarResultado(resultado) {
		campoBusqueda.value = resultado.tipo === 'estrella'
			? `${resultado.nombre}${resultado.personaje ? ` · ${resultado.personaje}` : ''}`
			: resultado.nombre;
		listaSugerencias.replaceChildren();
		if (resultado.tipo === 'estrella') {
			centrarCoordenada(resultado.x, resultado.y, 3.7);
			seleccionarConstelacion(resultado.constelacion, estrellasPorHip.get(resultado.hip));
		} else {
			centrarCoordenada(resultado.x, resultado.y, 2.8);
			seleccionarConstelacion(resultado.constelacion);
		}
		resultadoBusqueda.textContent = `Encontrado: ${resultado.tipo === 'estrella' ? resultado.nombre : resultado.nombre} · ${resultado.constelacion.name}.`;
	}

	function revelarArchivoSecreto() {
		if (!resultadoBusqueda) return;
		resultadoBusqueda.replaceChildren(document.createTextNode('Código secreto 2008 reconocido. '));
		const enlace = document.createElement('a');
		enlace.href = 'mantenimiento.html';
		enlace.textContent = 'Abrir archivo';
		enlace.className = 'secreto-encontrado';
		resultadoBusqueda.append(enlace);
		listaSugerencias.replaceChildren();
	}

	let arrastre = null;
	mapaSvg.addEventListener('pointerdown', (event) => {
		if (event.button !== 0 || event.target.closest('a[href]')) return;
		arrastre = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			startView: { ...vistaActual },
			moved: false
		};
		mapaSvg.classList.add('arrastrando');
		mapaSvg.setPointerCapture(event.pointerId);
	});

	mapaSvg.addEventListener('pointermove', (event) => {
		if (!arrastre || arrastre.pointerId !== event.pointerId) return;
		const limite = mapaSvg.getBoundingClientRect();
		const deltaX = (event.clientX - arrastre.startX) * arrastre.startView.width / limite.width;
		const deltaY = (event.clientY - arrastre.startY) * arrastre.startView.height / limite.height;
		if (!arrastre.moved && Math.hypot(deltaX, deltaY) < 5) return;
		arrastre.moved = true;
		actualizarVista(
			arrastre.startView.x - deltaX,
			arrastre.startView.y - deltaY,
			arrastre.startView.width,
			arrastre.startView.height
		);
	});

	function finalizarArrastre(event) {
		if (!arrastre || arrastre.pointerId !== event.pointerId) return;
		if (arrastre.moved) mapaSvg.dataset.dragged = 'true';
		mapaSvg.classList.remove('arrastrando');
		arrastre = null;
	}

	mapaSvg.addEventListener('pointerup', finalizarArrastre);
	mapaSvg.addEventListener('pointercancel', finalizarArrastre);
	mapaSvg.addEventListener('lostpointercapture', finalizarArrastre);

	mapaSvg.addEventListener('wheel', (event) => {
		event.preventDefault();
		const caja = mapaSvg.getBoundingClientRect();
		const centro = {
			x: vistaActual.x + (event.clientX - caja.left) / caja.width * vistaActual.width,
			y: vistaActual.y + (event.clientY - caja.top) / caja.height * vistaActual.height
		};
		ampliar(event.deltaY < 0 ? 1.2 : 1 / 1.2, centro);
	}, { passive: false });

	mapaSvg.addEventListener('pointerover', (event) => {
		const estrella = event.target.closest('[data-star-name]');
		if (!estrella) return;
		const constelacion = constelacionesPorId.get(estrella.dataset.constellationId);
		const estrellaDetalle = estrellasPorHip.get(Number(estrella.dataset.starHip))
			|| constelacion?.stars.find((item) => item.name === estrella.dataset.starName);
		if (constelacion) seleccionarConstelacion(constelacion, estrellaDetalle);
	});

	mapaSvg.addEventListener('click', (event) => {
		const estrella = event.target.closest('[data-star-name]');
		if (mapaSvg.dataset.dragged) {
			delete mapaSvg.dataset.dragged;
			return;
		}
		if (event.target.closest('a[href]')) return;
		const grupo = event.target.closest('.constelacion-mapa');
		if (!grupo && !estrella) return;
		const idConstelacion = estrella?.dataset.constellationId || grupo?.dataset.constellationId;
		const constelacionSeleccionada = constelacionesPorId.get(idConstelacion);
		const estrellaDetalle = estrella && estrellasPorHip.get(Number(estrella.dataset.starHip));
		if (constelacionSeleccionada) seleccionarConstelacion(constelacionSeleccionada, estrellaDetalle);
	});

	mapaSvg.addEventListener('keydown', (event) => {
		if (event.target.closest('a[href]')) return;
		const grupo = event.target.closest('.constelacion-mapa');
		if (!grupo) return;
		if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
			event.preventDefault();
			const distancia = vistaActual.width * 0.08;
			const deltaX = event.key === 'ArrowLeft' ? -distancia : event.key === 'ArrowRight' ? distancia : 0;
			const deltaY = event.key === 'ArrowUp' ? -distancia : event.key === 'ArrowDown' ? distancia : 0;
			actualizarVista(vistaActual.x + deltaX, vistaActual.y + deltaY, vistaActual.width, vistaActual.height);
		} else if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			const constelacion = constelacionesPorId.get(grupo.dataset.constellationId);
			if (constelacion) seleccionarConstelacion(constelacion);
		}
	});

	document.querySelector('#acercar-mapa')?.addEventListener('click', () => ampliar(1.5));
	document.querySelector('#alejar-mapa')?.addEventListener('click', () => ampliar(1 / 1.5));
	document.querySelector('#centrar-mapa')?.addEventListener('click', () => {
		actualizarVista(vistaCompleta.x, vistaCompleta.y, vistaCompleta.width, vistaCompleta.height);
	});

	formularioBusqueda?.addEventListener('input', () => {
		const termino = campoBusqueda.value.trim();
		if (!termino) {
			resultadoBusqueda.textContent = '';
			listaSugerencias.replaceChildren();
			return;
		}
		if (termino === '2008') {
			resultadoBusqueda.textContent = 'El firmamento reconoce ese código.';
			listaSugerencias.replaceChildren();
			return;
		}
		const coincidencias = buscarCoincidencias(termino);
		mostrarSugerencias(coincidencias);
		resultadoBusqueda.textContent = coincidencias.length
			? `${coincidencias.length} coincidencias.`
			: 'No encontré ese nombre en el cielo.';
	});

	formularioBusqueda?.addEventListener('submit', (event) => {
		event.preventDefault();
		const termino = campoBusqueda.value.trim();
		if (termino === '2008') {
			revelarArchivoSecreto();
			return;
		}
		const coincidencias = buscarCoincidencias(termino);
		if (!coincidencias.length) {
			resultadoBusqueda.textContent = 'No encontré ese nombre en el cielo. Prueba con otra estrella o constelación.';
			listaSugerencias.replaceChildren();
			return;
		}
		enfocarResultado(coincidencias[0]);
	});
}

const seccionHistoria = document.querySelector('.historia');
if (seccionHistoria && 'IntersectionObserver' in window) {
	const observadorHistoria = new IntersectionObserver(([entrada]) => {
		cuerpo.classList.toggle('cielo-abriendo', entrada.isIntersecting);
	}, { threshold: 0.08 });
	observadorHistoria.observe(seccionHistoria);
}
