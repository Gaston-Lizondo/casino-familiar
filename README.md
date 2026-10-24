# 🎰 Casino Familiar

Casino de **fichas de mentira** para jugar en familia. Sin dinero real, sin pagos, sin cuentas. Solo diversión.

**Juegos:** Tragamonedas · Ruleta europea · Blackjack · Dados · Raspadita
**Estilo:** neón arcade, pensado para el celular.

## Probarlo en 10 segundos

Abrí `index.html` con doble clic (anda sin instalar nada). Para el celular, publicalo (abajo).

## Publicarlo gratis en GitHub Pages

1. En GitHub: **New repository** → nombre `casino-familiar` → Public → Create.
2. **Add file → Upload files** y arrastrá **el contenido** de esta carpeta (que `index.html` quede en la raíz del repo, no dentro de otra carpeta). Commit.
3. **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main` / `/ (root)` → Save.
4. En 1–2 minutos queda en `https://TU-USUARIO.github.io/casino-familiar/`. Ese link es el que abren desde el celu.

Con Git en la terminal:

```bash
git init && git add . && git commit -m "Casino Familiar v1"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/casino-familiar.git
git push -u origin main
```

## Cómo se usa

- Cada uno elige su perfil (Gastón, Eli, Dante, Mía) y arranca con **1.000 fichas**.
- **No hay recarga automática**: si alguien se queda en cero, se le reponen desde **⚙️ Admin** (PIN por defecto: `1234`).
- Desde Admin también se puede fijar un saldo exacto, agregar/eliminar jugadores y reiniciar todas las fichas.

> ⚠️ **Importante (versión local):** las fichas se guardan en el navegador de *cada dispositivo*. El saldo de Dante en el celu de Dante es distinto al de Dante en la compu de papá. Para que las fichas sean compartidas entre dispositivos hace falta el modo multijugador (ver abajo).
>
> El PIN de Admin está en `js/config.js`, que es público en GitHub: sirve como candado para los chicos, no como seguridad.

## Qué se puede cambiar (`js/config.js`)

Fichas iniciales, PIN, valores de apuesta (10/50/100/500) y los jugadores iniciales. Los jugadores nuevos se agregan desde Admin sin tocar código.

## Retornos (porcentaje teórico que "devuelve" cada juego)

| Juego | Retorno |
|---|---|
| Tragamonedas | 96,1 % |
| Ruleta | 97,3 % (todas las apuestas) |
| Blackjack | 99,5 % con estrategia básica perfecta; ~94 % jugando "como el crupier" |
| Dados | 95,0 % – 95,8 % |
| Raspadita | 65,0 % (como una raspadita de lotería real) |

Verificado con simulaciones (`node tests/engines.test.js`). A la larga la casa siempre gana, como en un casino de verdad: ningún juego devuelve el 100 %.

**Reglas del blackjack (mesa estándar de casino):** 6 mazos, el crupier se planta en cualquier 17 y mira su carta oculta con 10 o As, blackjack paga 3:2, se puede doblar con las dos primeras cartas (también después de separar), separar pares hasta 4 manos (los ases reciben una sola carta y no se vuelven a separar), seguro 2:1 cuando el crupier muestra As, sin rendición.

## Cómo está armado (listo para multijugador)

```
index.html
css/style.css
js/config.js            ← ajustes
js/core/rng.js          ← azar (crypto)
js/core/store.js        ← guardado: HOY localStorage, intercambiable
js/core/sfx.js          ← sonidos
js/engines/*.js         ← reglas de cada juego: lógica pura, sin pantalla
js/ui/*.js              ← pantallas (una por juego) + app
tests/                  ← pruebas de motores (node) y de interfaz (playwright)
```

La idea clave: **los motores no saben nada de pantalla ni de dónde se guardan las fichas**. Reciben un estado y devuelven el estado nuevo (el de blackjack es una mesa con varios asientos y turnos, 100 % serializable).

### Para pasar a multijugador (Firebase, plan gratis Spark)

1. **Guardado compartido:** escribir un adaptador con la misma interfaz que `js/core/store.js` (`adjustChips`, `listProfiles`, `subscribe`, …) apoyado en Firebase Realtime Database + login anónimo. El resto del juego no cambia.
2. **Mesas compartidas (blackjack, ruleta):** un dispositivo hace de "crupier" por mesa (sin Cloud Functions, que son pagas) y publica el estado de la mesa; los demás mandan sus acciones. El motor ya soporta varios asientos.
3. **Reglas de seguridad de Firebase** para que cada persona solo toque sus fichas y el mazo no sea visible para los jugadores.

Hoy el resultado de cada tirada se decide y se acredita **de una vez** (como lo haría un servidor) y la animación solo lo muestra; eso ya es compatible con ese modelo.

## Pruebas

```bash
node tests/engines.test.js      # 22 pruebas de reglas, pagos y retornos
python3 tests/ui-smoke.py       # recorre toda la app en un celular virtual (requiere playwright)
```
