# Privacitat de les dades

## El que has de fer ara

**Anul·la la clau d'API que has fet servir fins ara.** Ha quedat escrita en un fitxer que està pensat per compartir-se i ha viatjat per una conversa. Una clau exposada no es "neteja": es revoca i se'n crea una de nova.

1. Ves a [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. **Revoke** sobre la clau antiga
3. **Create new secret key** i posa la nova al fitxer `.env` (mai al `.env.example`)
4. A *Usage* comprova que no hi hagi consum que no reconeguis

Mentre no ho facis, qualsevol que hagi vist aquell fitxer pot gastar crèdit del teu compte.

---

## "100% de privacitat" amb OpenAI: no existeix

Val la pena ser precís, perquè la diferència importa.

**El que sí que és cert amb l'API de pagament:**

- Les dades enviades per l'API **no s'utilitzen per entrenar** els models d'OpenAI. Això és política per defecte des del març del 2023 i està al seu compromís de privacitat per a empreses.
- La retenció per defecte és de **30 dies** per a monitoratge d'abús, i després s'esborren.
- Pots signar un **DPA** (contracte d'encarregat del tractament) amb OpenAI, necessari si algun dia tractes dades de tercers i no només teves.

**El que no pots aconseguir en un compte normal:**

- **Zero Data Retention (ZDR)** — que els prompts es processin en memòria i no es guardin gens — existeix, però no és un interruptor que puguis activar tu. Requereix aprovació prèvia, contracte enterprise i un cas d'ús que ho justifiqui. No s'aplica a comptes de pagament per ús.
- Encara amb ZDR, es conserven certes metadades i registres d'abús durant un temps limitat per obligacions legals.

**I el punt que sol passar desapercebut:** una política de retenció no és una garantia tècnica, és un compromís contractual que un jutge pot suspendre. El 2025, arran del litigi amb *The New York Times*, un tribunal va ordenar a OpenAI **conservar** dades que la seva pròpia política deia que esborrava. Com a estudiant de dret ho veuràs de seguida: entre "esborrem als 30 dies" i "les teves dades no existiran enlloc" hi ha exactament la distància d'una ordre judicial.

Conclusió: amb OpenAI tens una privacitat **raonable i contractualment protegida**, no absoluta. Per a dades de la teva cartera personal probablement és suficient. Per a "100%", no ho és.

---

## Si vols 100% de veritat: model local

L'única manera que les dades no surtin de l'ordinador és que no surtin de l'ordinador. Aquest projecte ja hi està preparat.

```bash
# 1. Instal·la Ollama — https://ollama.com
# 2. Descarrega un model
ollama pull qwen2.5:14b
```

Al teu `.env`:

```
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=qwen2.5:14b
OPENAI_API_KEY=no-cal
```

`npm start` i llest. Ollama exposa una API compatible amb la d'OpenAI, així que no cal canviar ni una línia de codi. Quan arrenqui, el servidor t'ho confirmarà per consola: *"LOCAL — cap dada surt d'aquest ordinador"*.

**El compromís:** un model de 14B en un portàtil és clarament més fluix que un model gran al núvol — raona pitjor i va més lent. Si el teu Mac té 16 GB de RAM, `qwen2.5:14b` hauria d'anar; amb 8 GB, prova `qwen2.5:7b` o `llama3.1:8b`. Per al tipus de preguntes d'aquest agent (llegir dades estructurades i comentar-les) n'hi ha prou.

---

## Minimitza igualment, facis el que facis

Aquest és el principi que val tant per al núvol com per al local, i és el que menys es practica: **l'agent no necessita les teves dades identificatives per fer la seva feina.**

Per analitzar solapaments, concentració i escenaris només calen tickers, percentatges i categories. No calen:

- El teu nom, DNI o NIF
- Números de compte, IBAN o identificadors del bròker
- Imports absoluts (`45.000 €` → `32%` funciona igual de bé)
- El nom del teu bròker o entitat

La Google Sheet connectada conté la combinació real de posicions i imports.
Quan uses l'agent al núvol, aquest context s'envia al proveïdor del model. Evita
afegir-hi noms, identificadors personals, números de compte o altres dades que
no siguin necessàries per analitzar la cartera.

Un ISIN és públic. La teva combinació de posicions amb imports, no.

---

## Higiene bàsica del projecte

| Risc | Estat |
|---|---|
| Clau al codi font | Mai. Sempre a `.env`, que està ignorat |
| Clau al navegador | No hi arriba: el proxy del servidor la manté al backend |
| Servidor exposat a la xarxa | Escolta només a `127.0.0.1`, no és accessible des d'altres dispositius |
| Pujar-ho a GitHub | Revisa el `.gitignore` abans del primer `git add`. Si un secret s'ha arribat a commitar, canviar-lo després no serveix: queda a l'historial |
| Desplegar-ho a Vercel o similar | No ho facis sense autenticació. Quedaria públic a internet amb la teva clau pagant les consultes de qualsevol |
| Disc del portàtil | Activa FileVault (Mac) o BitLocker (Windows). És la protecció més bàsica i la que més gent es salta |

---

## Fonts

- [Data controls in the OpenAI platform](https://developers.openai.com/api/docs/guides/your-data)
- [How we're responding to The New York Times' data demands](https://openai.com/index/response-to-nyt-data-demands/)
- [Ollama](https://ollama.com)

Aquest document explica el funcionament tècnic del projecte i no és assessorament jurídic en matèria de protecció de dades.
