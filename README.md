# Cartera Agent

Dashboard de la cartera sincronitzat amb Google Sheets i amb un agent conversacional integrat en un panell lateral. L'agent veu les mateixes posicions que el dashboard i pot investigar notícies i pàgines web públiques amb fonts.

Funciona amb l'API d'OpenAI o amb un **model local** (Ollama), sense canviar codi. Si hi poses dades econòmiques reals, llegeix primer **[PRIVACITAT.md](PRIVACITAT.md)**.

## Posar-ho en marxa

Necessites **Node 20 o superior**. Comprova-ho amb `node --version`.

```bash
cd cartera-agent
npm install
cp .env.example .env      # a Windows: copy .env.example .env
```

Obre el fitxer `.env` amb qualsevol editor de text i posa-hi la teva clau d'OpenAI:

```
OPENAI_API_KEY=sk-la-teva-clau-real
OPENAI_MODEL=gpt-5.6-terra
DASHBOARD_PASSWORD=una-contrasenya-llarga
AUTH_SECRET=un-secret-aleatori-de-com-a-minim-32-caracters
```

La clau la generes a [platform.openai.com/api-keys](https://platform.openai.com/api-keys). Comprova a [la llista de models](https://platform.openai.com/docs/models) quin tens disponible al teu compte i posa'l a `OPENAI_MODEL` — si el que hi ha per defecte no existeix, el servidor et retornarà un error clar dient-t'ho.

Després:

```bash
npm start
```

I obre **http://localhost:3000** al navegador. Per aturar-ho, `Ctrl+C` a la terminal.

En local, si no configures les variables d'accés, es conserva temporalment el
codi anterior per facilitar el desenvolupament. En un desplegament de Vercel,
`DASHBOARD_PASSWORD` i `AUTH_SECRET` són obligatòries.

## Desplegar a Vercel

El projecte ja inclou la configuració de desplegament. Abans de desplegar:

1. Comparteix la Google Sheet amb permís de lectura per enllaç.
2. A **Settings → Environment Variables**, configura `DASHBOARD_PASSWORD`,
   `AUTH_SECRET`, `OPENAI_API_KEY` i `OPENAI_MODEL`.
3. Torna a desplegar el projecte.

El botó **Sincronitza fulla** força una lectura nova de les tres pestanyes
resum. Si canvies de document, configura `GOOGLE_SHEET_ID` a Vercel.

Les pestanyes de broker incorporen a K:M el tancament anterior i la variació
diària dels ETF. `RESUM FONS ANDORRA` usa K:M per comparar el valor actual amb
una referència setmanal, actualitzada automàticament cada divendres.

Durant el desenvolupament pots fer servir `npm run dev`, que reinicia el servidor sol cada cop que canvies un fitxer.

## Estructura

```
cartera-agent/
├── .env                  ← la teva clau (no existeix fins que la crees; mai es puja enlloc)
├── .env.example          ← plantilla
├── .gitignore
├── package.json
├── server.js             ← servidor Express + proxy cap a OpenAI
├── scenario-model.js     ← càlcul reproduïble dels percentils
├── data/
│   ├── market_cache.json ← metadades complementàries
│   ├── scenario_assumptions.json ← hipòtesis, fonts i correlacions
│   └── settings.json     ← exposicions i configuració
├── sheet-store.js        ← lectura i normalització de Google Sheets
└── public/
    └── index.html        ← dashboard + panell de xat
```

## Com funciona

El navegador **mai** veu la teva clau d'API. Quan escrius al xat, el frontend envia la conversa a `/api/chat` del teu propi servidor; el servidor hi afegeix la clau, el prompt de sistema i el context de la cartera, crida la Responses API d'OpenAI i et retorna la resposta en streaming (paraula a paraula). La cerca web s'activa quan la consulta necessita informació pública actual i les fonts apareixen com a enllaços clicables.

El context que rep l'agent es construeix automàticament a partir de la Google Sheet: perfil d'inversor, marc fiscal, posicions i solapaments. A més, a cada missatge s'hi afegeix l'estat viu del dashboard.

## Modificar les dades

Les participacions, costos i valors actuals venen de les pestanyes `RESUM
BROKER LDM`, `RESUM BROKER XCB` i `RESUM FONS ANDORRA`. El fitxer
`data/market_cache.json` completa metadades, mentre que
`data/scenario_assumptions.json` conté les hipòtesis i fonts del model.

| Camp | Què és |
|---|---|
| `type` | `"ETF"` o `"Fons"` |
| `bucket` | `"llarg"` — horitzó d'inversió |
| `scenario` | Retorn anual net, volatilitat, grup de correlació, confiança i fonts |
| `ex` | Desglossament d'exposició subjacent, ha de sumar ~100 |
| `note` | Text de la fitxa desplegable (admet HTML bàsic) |

Després de canviar el JSON, refresca el navegador. Si has canviat alguna cosa que afecta l'agent, reinicia també el servidor.

## Regles de liquiditat — important per a l'agent

**Fons d'inversió** (`"type": "Fons"`):
- **No es poden vendre** directament des del bròker de manera aïllada.
- Operacions permeses: **traspàs** a un altre fons (lliure de tributació mentre sigui fons → fons, art. 94 LIRPF) o **subscripció de participacions noves** d'un fons existent o nou.
- En cas de voler reduir exposició, s'ha de traspassar a un altre fons (p. ex., un monetari de CreAnd o de la mateixa gestora).
- L'agent pot suggerir **fons nous de CreAnd** com a destinació de traspàs quan sigui adequat.

**ETFs** (`"type": "ETF"`):
- **Es poden vendre** en qualsevol moment al mercat secundari.
- La venda **tributa** en IRPF com a guany o pèrdua patrimonial de l'exercici.
- Les pèrdues cristal·litzades compensen guanys del mateix exercici o dels 4 anys posteriors.
- Estratègia possible: vendre ETFs amb pèrdues per compensar guanys d'altres vendes.

Aquesta distinció és **crítica** per a qualsevol decisió de reequilibri: tocar els fons és gratuït fiscalment; tocar els ETFs, no.

## Personalitzar l'agent

El prompt de sistema és la constant `SYSTEM_PROMPT` a `server.js`. Allà hi ha les regles de comportament: Ets un expert assessor en gestió de patrimoni familiar i fiscalitat. El teu rol és proactiu: analitzes la cartera, identifiques ineficiències i planteges preguntes intel·ligents per optimitzar el risc. Parla en català, mai donis ordres directes d'inversió (fes servir suggeriments argumentats) i respecta sempre la limitació operativa: els fons només es poden traspassar, mai liquidar directament. No inventis dades i tracta els escenaris com a referències il·lustratives.

Les preguntes suggerides que apareixen als botons del xat són la constant `CHIPS` a `public/index.html`.

## Pestanyes

El dashboard es divideix en quatre pestanyes:

- **Cartera** — KPIs de rendiment, escenaris P10/P50/P90 i metodologia, taula de
  posicions, gràfic de bandes, definidor d'estratègia i duplicats.
- **Anàlisi** — el bloc de diagnòstic descrit a sota.
- **Notícies** — flux de titulars recents associats als valors visibles de la cartera.
- **Consell** — informe sota demanda que classifica EUA, Europa, Japó i altres
  desenvolupats, emergents, small caps globals, renda fixa en euros i efectiu
  amb una visió estratègica i una altra de tàctica. Mostra l’exposició actual,
  bandes orientatives, riscos, catalitzadors i fonts web; no executa operacions.

El flux de notícies combina Google News amb el registre de fonts prioritàries
proporcionat per l’usuari: BCE, Fed, FMI, OCDE, Banc d’Espanya, CNMV i FCA com
a fonts oficials o reguladores; Financial Times, Reuters, WSJ, Bloomberg,
CNBC, MarketWatch, Yahoo Finance, Investing.com, The Economist i altres fonts
financeres per al context de mercat; i CoinDesk/CoinTelegraph per a cripto.
La pàgina de cerques de la SEC es conserva com a font de consulta, però no es
tracta com un feed RSS.

Els filtres de categoria, tipus i cerca viuen **fora** de les dues pestanyes i
s'apliquen a totes dues alhora: si filtres per fons a Cartera i canvies
d'Anàlisi, el diagnòstic ja només compta aquells fons i ho indica al costat del
títol. El selector d'horitzó només afecta els escenaris, així que s'amaga quan
ets a Anàlisi.

## Diagnòstic de la cartera

La pestanya Anàlisi conté quatre targetes que es recalculen amb cada canvi de
filtre, igual que la taula i l'exposició agregada:

| Targeta | Què mesura |
|---|---|
| Risc de concentració | Pes de les 5 posicions principals, índex HHI i posicions efectives (`10.000 / HHI`) |
| Distribució per classe d'actiu | Agrupació pel `group` del model d'escenaris: renda variable EUA, Europa, emergents, global, cripto i renda fixa |
| Exposició real agregada | Exposició subjacent travessant els productes, des del camp `ex` de `market_cache.json` |
| Les teves inversions, visualitzades | Treemap on la mida és el pes i el color la variació del període |
| Solapament i correlació | Parells de posicions que es trepitgen, ordenats per exposició duplicada estimada |

Totes les xifres es calculen al navegador a partir de `/api/portfolio`: **cap
text d'aquest bloc surt del model**, així que no pot inventar-se dades ni
consumeix crèdit. El que sí que fa servir l'agent són les preguntes de
seguiment de cada targeta: porten incorporats els tickers i els percentatges
reals, i en clicar-les s'envien al panell de xat. Els quadres del treemap també
són clicables i obren l'anàlisi de la posició corresponent.

Dues limitacions que les targetes expliciten a la interfície: l'exposició
duplicada és una estimació (`min(pes_a, pes_b) × correlació`, perquè la
duplicació no pot superar la posició més petita) i els períodes del treemap no
són comparables entre ells, ja que els ETF porten variació diària i els fons
setmanal.

## Fer-lo servir amb un model local

Si no vols que les dades surtin de l'ordinador, instal·la [Ollama](https://ollama.com), descarrega un model (`ollama pull qwen2.5:14b`) i canvia el `.env`:

```
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=qwen2.5:14b
OPENAI_API_KEY=no-cal
```

No cal tocar cap línia de codi: Ollama exposa una API compatible. Quan arrenqui, la consola et confirmarà que està en mode local. Detalls i compromisos a [PRIVACITAT.md](PRIVACITAT.md).

## Endpoints

| Ruta | Què fa |
|---|---|
| `GET /api/health` | Comprova que el servidor va, quin endpoint fa servir, si és local i quantes posicions carrega |
| `POST /api/login` | Valida la contrasenya i crea una cookie de sessió segura |
| `GET /api/session` | Comprova si la sessió continua activa |
| `POST /api/update-prices` | Força una nova lectura de Google Sheets |
| `POST /api/chat` | Rep `{ messages, estat }` i retorna la resposta d'OpenAI en streaming SSE |
| `POST /api/advice` | Genera sota demanda un informe estructurat de mercats amb fonts web actuals |
| `GET /api/portfolio` | Retorna la cartera combinada amb els darrers preus |

## Avisos

Els escenaris del dashboard són percentils P10/central/P90 d'una distribució orientativa. Es calculen a partir d'hipòtesis documentades de retorn net, volatilitat i correlació; no són prediccions, probabilitats de guany ni objectius de preu. Les hipòtesis de renda variable parteixen de les previsions per classe d'actiu de Vanguard de juny de 2026 i resten el TER. Els productes temàtics no reben cap prima d'alpha: hereten el retorn del mercat pare i una volatilitat analítica superior. Les divises, els impostos i els canvis futurs de valoració no es modelen explícitament.

Cada conversa consumeix crèdit del teu compte d'OpenAI. El context de la cartera són uns quants milers de tokens que s'envien a cada missatge — si t'importa el cost, vigila el model que tries.
