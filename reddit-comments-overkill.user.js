// ==UserScript==
// @name         Reddit Comments Overkill
// @namespace    https://github.com/xpufx/reddit-comments-overkill
// @version      2.35
// @description  Deletes all comments by cycling sorts reliably, retrying on rate limits, waiting for comments, handling infinite scroll & next page, with Start/Stop control.
// @downloadURL  https://github.com/xpufx/reddit-comments-overkill/raw/refs/heads/main/reddit-comments-overkill.user.js
// @updateURL    https://github.com/xpufx/reddit-comments-overkill/raw/refs/heads/main/reddit-comments-overkill.user.js
// Old Reddit
// @match        https://old.reddit.com/user/*/comments*
// STILL Old Reddit but with RES etc that displays all reddit on the normal address
// @match        https://www.reddit.com/user/*/comments*
// @grant        none
// @run-at       document-idle
// ==/UserScript==


(function() {
	"use strict";

	/***********************
	 * CONFIG
	 ************************/
	const SCRIPT_NAME = "Reddit Comments Overkill";
	const LOGGING_ENABLED = true; // Set to false to disable console logging
	const SORTS = ["new", "hot", "top", "controversial"];
	const WAIT_FOR_COMMENTS_MS = 8000;
	const RATE_LIMIT_MAX = 1800000;
	const SHORT_DELAY_MIN = 1000;
	const SHORT_DELAY_MAX = 1000;
	const LONG_DELAY_AFTER = [10, 20];
	const LONG_DELAY_MS = [10000, 15000];
	let daysToPreserve = 10; // Keep comments from the last N days (set to 0 to delete all comments regardless of age)
	let preserveDotComments = true; // Preserve comments that end with a dot (.) on its own line
	let dryRun = false; // Dry run mode: log actions without actually deleting
	let simulate = true; // Simulation mode: click "No" on confirmation instead of "Yes" — safe for debugging

	// Embedded logo images (base64)
	const LOGO_48 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAA0CAYAAADMk7uRAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGYktHRAD/AP8A/6C9p5MAAAAHdElNRQfqBRUEEwZbqfbiAAAX/UlEQVRo3tWaaZScV3nnf+/7VtVb+9r73l3q1t7aZUmW5E3Gso3s8Z6xgRAmwCHOBDKBZJgJHyY+JBkOSYZhJhz2zTNkMGAZgyx5kRdZkrW2pG71vndXV3VVV9de9e7vfDADOAYCAWYmzzn3y/1w7/93nvvc8zz3PvAv3ITfxqLffuMcp85fYj6RZqWQxx/wsaGnmz3rtvPILdv//wPY/tjvkjd0RH8Qy+nEEp1oooOS20mpvgtnboWwUiJkWYi2DoaGXavgR2Pga0/+vwNY+9i70JwyquTGl1+WjVCsxRTEuG0LPUhiiyA6ghaiCzAk7KKInZAkpgTbnKS0mjTCLarLqCBUa4x+46v/9wDWPPAIiiQTd62Ks2L9Gs0S3yGJ0u1er6c/Ggo11ofDnmjAR8DjwSE50EyTkqKSK5dZKRZruXI5pajqFds0Tsii9WLbk5+bnn/kD+yAVuXKk1/77QHsuusOFqQQN4tJ4TVHx1ZLkt7rDwTu6Wtr7dqzvpctPV1EA34sy6Kqaiiahm3biKKIR3bhll0ICKQLJQZm5rgwOW3PppanFEX5nsOwvj7d3TvcMzlEZGWaS8df/c0CdB++h5Lbh9MwmgyH4wPBYPD9ezaua7tn325aYxGmkstcm54nlS9giwJelwuvLCOIIqZpoZs6FVXDITloiYbp72qnrS7KbHqF75+/zMDE1HStWv172dK+qguOVX+tyPB3n/rNALQfuI2F+UM09V88YDnkJ/rX9Bz8vbtvF5oiEU4ODDI6v0hrfYy96/pY39FGS10Mv9vN6NwCz5+/jEOATfFu1nS0UtY0rk7PcW5iimyxzLbuDm5Yt4bJ1DLfevl1c3Jx6bio1T6RdYQHGotJJp956tcDaNlzCyHRcGT8kcc8wdATD9x6oP3eA3s5dWWQi6Pj3Lh5E/fsu4F4SzOlcgnZ5cLn8bKSy/HnX/w6ukOiv6uTycVFPA6JI3tv4MYt/eimyVhiiS889wI+t8w9N+xEMXS+dPwlzg6NjBma+tEdyvIPh3SPPX3s6M/VJ/0i8R279uO0TOeqL/yhcCT6qT98+N6GnWt7+dLTx3BKEn/26MPce+Me6kNBiuUyo7NzdDQ12ZIo1J595XUxWS2LHZ2tnLw0yGg6Q7Gmcnlsgkw2x9beOD63DJaJgMDQ9BzdTQ1s74vj8XjrxuaWbp1RhUSbWR52tsTt/NzUrwbQvnE7dZYipoKxfxOORv/zn7z74WDY5+Ur3z/GAzft548evo/mWBTDMKkqCheGRohFQoR8vrlXzp7/86dfe33zhv71kelEisuJJRTdZGFyjkwuz9DMPP3dHXjdMtdn5hBFkf1bNlIoVzhx7hI3rOsj3trkvzY1dyBrCBMLD985umOpSDI598sBfBB4ecd+VFE+7A0G/+uHH30o6nG5+PaJk/zJow9x380HcEoStm1TVmpkCwUGRibYGO/hb7/4JdffPflkc+vavjUZxXCeG59BMU2MQpFKNkupUEJVFG7ZuRUEEASBTfFuxmfmGJyaoT4c5uirp7lpWz/NdRHfwOT0Lu/Q2Jm0Q15SZ8Z+OYCZHftxa+oawe35wu/eczgeb2nmyWeP8/H3Psptu3YA9psBJAjkSiWuT8+iGwZzs1Okxs84G3xye9lT5zw7NkVF1UA3qGWy1IolREmiP97NI7cdxAS621oYnZyhXK7w6OHb2NUbR7Dhm8de4MiBvQgC0eHphS7Z1I+H2zqrxfnpt2gV/7H4tlAQl2nImij96Z7+DVsObNnEN47+gD948Ai37PxRHmNDtVbDtm1UXWd6fhGHAJfeOEU5lWK1JpAp16hVFSxNRyuVqeXziIJAwOfnvgN76elop6etlYWFBLIkcXjfDQwMDjMyOc0DN+/nvpv28c1jL3Lkxr1s6Gi/TTHtD3ht82163zZR67+RoiQeqo9Ffuexu27n6Asvs3fzBvZt2cTi8jKL6TSrhaK5vJyx8oUCoiBgmya2aXH2+jTHp2uo0TYW01kMVcNQNLR8Ab2mgGmzprGe+26/Ca/HjVqt4XU5iUVCfPW7R/F5PfSvX0fA5+Pdhw/REg7y6vnLvPvuQ1Ig6P9QRnT31+3c//MBugCptBoQHfLjdx3YFyiUyuRyefZv6+ePv/xd/uh/Hucj33uBjz/1rJTK58WB68PEQkG6WpvYumE98fWbqO9bR041yK2uYusaVq2KUshjYyHLLjrqgnjdHmSnC7/HjWKY/I/vP8eB3Ttpb2nGxsYGPG43jz90D8OTU3jdMvu3bW4zLPODTkN3/vwY6N2I4vDe3tLW8rH33X/E+b3nXuS9996NKIk8fWWWUGsHrlCUhcwqt/a1MzufYDWfp6ulmVg4xPFTpynbAtOJFLpuYOsGRrmMUirh9vgIumUChQXmEnMITi/x7i7mE0vs7t9ER3MT9ZEIXtn9o1NqEwuFKJXKvHTuMrfv2cm5a8NtFcN8vr4pmCouLb/dAw5NdZqi8MieLZu9qcwKssPBTTfsIN7Wyo6YF2lpnvFTZ2jXa/icLlqaGvm7r/8Di6k0V66PMJHJMjo6SaVQwjZNjEoFpVAA28IbDJIvFhG0Gl3lcU7/4Ct85vN/TyQYYtv6dbTU1eF2ObGx3hy2hWVZ3HVwH7lcHsu22bJ+bZOO+IAfVfiZHpBau3o8weAn3v2v7gqfOn+ZO/bvYdfmjUSCAQ7t7ueduzfT5ra4eVMfyUyGYqVCPl+gtbGBY6+fZrJQwtB1DM3AMgzUQh7bNPBGwgSDQWRJYlWHwkqWjX6dBleN09cGGZ1L0dDQSCQUBMHGsi0sy8ayLPxeL4l0hpGpGTb1xTk7cNVXrJjfVdNLNQDH/xHfH1/LGOLueGtTm88jk13NcXDHNhaTKa6NjCNIIoIo4PLIFCoVbNPku5cGuHXbZsI+L/MLCYrpDKqqYwN6uQymSSAYoGFNnCOb17M13s1Tr55mJJlieT7D3uwMO7qiVBfKfPGLY6zfupdDB/ZRH4tiY2LZNghw066t/Kf/9kVu2LaZ+kikL1Eub0h63Keaa8pPPNBbXy8siu7379+1Y4/P7UZTVB666x28cuoMNcsGl0xB0SgbJrVqDVPTUBHIFUs8eOgmTMNkYGyaalVDV2qYmkK4oQ7TsmiPhPjD+9/J+ngX99x8gHqfl8lsiQs5g/mVCs1WmQ1Bi3RyhpPnB8jVTBobGnDLMpZp4fN4eOH1c7Q0NbKcXZVnFpeG/nswdlbPLP0EQIk0+jTZ85E7b9nfnUgusy7ezQ1bNzE8Oobg87FcVdFsEEURvyxTKRTobaxjcWae+eQyffFu9mxcy0quSNUCORzC5fFg2hYPHNiL3+3m6ImX8LtdxNtauefgPnweHxdXqpxLVllaTNFiFdkQs0mmFnj18nWquk1dXR1Bv4/B8SlyxRJer4ehkYnlNUbt2fTKsv1jACsQbXD4Ax++89aD0esj49yyZyfdne2MjE1QMUyqqk5HQ4y2+igrKys8e/4ClXKNtT1dDI9Pcuzkqxw+sJd7bztIayyEYFmIosDO7nbedechFhJLtLe2MjQ3x8jcPAGfn6b6KEf27GS1WOHcispQVqeUTtMrKzS7akxMT3D22ii25EKzLEan5+hoa+H8laGiZhjfrmSWtB/HgCFI4YDsCnqcTlRVp6Euhm1brFvXy7mLA0xPzDA56qUhEuJqMoMVjdLS1krPxo3UdXWzN5/nzMWrzKTTHNyzi4+++0G8HjcJXePC+AQzS0nijY3s3LCBfLHEyPQshUqFxx99kL94/Pd5+eJVvnz0OC9OTjN8ucAN0RzbO6NIlLn4XIKhnM2q7mDrxnU4RLFeMS0/UP4xgG0TcLlcHtO2MHUdEDh3ZQjdMGnr7ObloQkWDBUrMU733i0Ul9JcuTaMS5RoaGnC7/cxtpCgq62JbHaVo4qC2+/nWjKNNjODvbzM1q5OJjJZ3hib4t8/eASHAD88fpJ4TxfvvGU/m/p6+PaxFzl68izfz64wVsqxvyFPc8SDU3DzmhLG6XDgdDp8FdPyvuUWwhacDlGSTMtGFATOXR3kuYUczlgdiKB19iEmZ2nb2YdZLZC8Po43EmJkeIQLFy8xnV7F3dHKmoCf9sZ6njs3RElwsNsn0tDcRNqGM9eGGVQFSoUSV0fG2bdtM7fdvJ90JsMzx07Q2xvn8fc8wo07tvDVp49z9soIs/MrbErnqHeLVH0+bAEQcFii6HgLgI1tmZZlmZaBbZss50pIvghtjY1Yto0liFydnSMxPQfYCG6Ju2+7kb6+PhaSadKpZa7NL/L81SFODV0nm6sS8nixmmPMrWSJ9/SgWSaNho2tKuQKJV574yI5w2I6VwAELmcGME9fYmt7M0/88Qc4dvJ1vvXsi5xJJHAWSzR3iZimgW1Ytmhb9lsARMGuqbqmm6aFbYNbEskOT5JJZBEsA8s00PQqTft24QvI5Mbnef7MVeYSGVrqo0wvLOEsF2myQBVEwk1R7NQKJ87O8cF/fR8EQsiCSNQh4ZNl3A6J0YsXOJsq0bZ7N36PTLaskMwVWL06ys27tvPQkTvYvnk9p85dIpfPMzA8iqrqmIauCLquvAVAsu2CWlUqiqpHEB30drVzjyRxbmiCW/ft4JkzAxQ74hTzFisjo/hiUab9ES6efAO3qdDZ2sKOdWu4ZX0farXCl586ytqODhIli1yxQnusjpVcAackUCpY1IcCTK6ssJTMUHtNo7mxkZlsiWqlyO37t+B0OrEti+6OVuLd7fzg+VcYnZ2jVKmga2rOLVCu/DSAbFmrqqKmVnOFNq/fw/krg/R0tXPLrk2EfTKmUiW3mKK6WgC9hKKolOdnUZUq7fURNvR0sFwqUx28zvzcApNTMyzmK1iyn6dfPsOm2TnGF5ZRykUkDCKN9Thb6mna1IGcyHKgt4lGh0YyZdEUC3HqwiUs08QGREni9YsDxKJh0itZNFVbbLTtSvanAZpksTilaWMLiaWdLc2NfOWp7+P3e+lrb6NQLiMIELYSWAJ4ZJnlXI7maJSsXmYxUaFSWEV2OphYXALbprO9jVQ2R4PbQX41x+l0gmJNIRoOI9iQuD5GdGERn9eLbdl89hvfQlEUvC4nS5kM+UIRj+xkIb1CqaqCbfGh9zzChauDGJo6/LmZWf0dPw2QFN2mpagXZmbnH+vfuA7Z5cTjcHLnzTeSzeVwez3MzMwRDgUxDAOPz4ehG+hKDUsQKJTKtDU3c31mnsMH91IuV2hvrCfk9+EUe2isi5ArVwgHAwiI5Eol/F4PEjA1O0+8J47fI3P56jVaWluYnJpi+9atHH3pFZLZeVrqIvh9XubnFnXBMi9+p6HRJj3zE4ATu1zcfEo9vbi4lNV0LdbZ1kwyuczsQoJcoUA0FkO1oKLqOGybxPwikboYZUWjqijMzC+ykitQqirki2WCPg+ZdIaAR6aoWpQXlxBEkVw2h4iALUB6xSYWiaAaJpNTU8SiERLZHCXDYmZhic72DgJeD5gGa3u6KJYqZNIrCYdhXPlCeuat6fSXBxP43MFCxbIP2oIQLxQKeJ1ObE1jemGJy4PDyMDi0hLnh0bIZFbA0JiYnMEyjDdzecPEJUFuNYdHEqhVa6Qyq5wbHCaZXEatVBicmGF6YRFdqTEzu0Aul6NULDM6OUWxWGA2mWZyIYGqadiqxlIyhaIq3HnoZobHp5icmPxBHco3S4W89bZ6QN3+Dt1VTPvnkuk7b921TfzKp/6C9z18P3cc3Mvs1BQf++DvcejGPfzDD0/wvgfv5Yl/928pZFf49Cf+jPfcf4SH7z5MXcDL1nV9PPGxj3D/4UPcf/gQ5VKRumCAJz/z11y9PsyhPbv4yz/9MOcvX+E/Pv5+9m3fQqlY5iuf/iQDQyMMj0/T2dTAt/7LX+Nxycyk0mzZtJHnnz+p1oqFTyJyXc2vvr0iaz/7NIJuvByQ5eUPvet3sC2LT/7tZ2mur+ehdx4mlc7Qv34t7bEI29b3oagqqVyB+ro6nnnuBd730Y/zhf91FJ/PB8B/+KtPk13N8oFHHqA5FiUcDLFrXR8feOxhnn/tLBeGRomEw4QCPtwuF3XRKE6HBKaFYEMsEsbn9RD0+xkemyC7kj3n1vWX+2cnf3ZRv2BoKLqiez2y2RCLMTIxzdef+SGpTIZQKMTFq0OEAwF2bFhHX3cXA4PXyWRXsW2baCTC2p5uKkoNzTBQNI2lTJZsoYxtg2maqIbOg/e+E103+Ow3voVq2dj2Twa2DZYFNj+eE2yLZGKJc+cuqoJlfqHU3Jo79dNlMP/IRAQREC0sTMtCFB3kK1UK1RqXhoa5Oj3Fls3rydSqnDx3iXJN5flrQ4jhIDt3befy9RGmU8ucHJvgyKMPkTB1nvveM8ymV3jq/EWcTgdmuQqiCJbF9fkFDF1HMTSGFxfRNAN+JL6iqpi2TSqzgsOyXgphPRseucbkLwJ4M1cSOD0yxvJSCmybV4eGqZbKzKfSPPP6WXraWhiaX+TS0AgOh4vxRIKhNy7y3ImTKIZB36aNzCWTqJkVKk0NXB0ZQxdEFtIryNUa+Lzs3rmV5WMvMJ5aRtdUKjWFV4aGKSkKmCaGYXBi4ArTy2kEm5zL1D+z0n9bMTD3+bfofRuAZVuWbdvWdDKFVqnQEA5SVhRq1Sr5UpXV5RV0lwuxppBMZehobyNfLNLa1cFDDx2htFpAtEzUSoULZ86z+9BNrNuwlqmpeURD58xrp+ns7aGzt5uulmaUmoJlmNg2lCoVejrbKBeKSA6R1GoeTdfxORxOzbQ+7L5yMu5yuT+PVrN+5qsEgMsfdQgO5yMb1/U1SiE/8d44TrfMxNAog9fHaK6P0dbezOpSmjcuDRINBehqa6ZSq+F0udA1g0Iuj2TbnH7jEl6nE7/bQzqZIhr0c+36GMvJFD3traAbBP1eMAyWU2ma2loIN9azfftmZMMErxtXMMDGDWtdfp+vd3puUfflVr+Tx7R++sS8xVqb44604PjLDZvWfWzv/j0giSzNL3Lm/FWCAT+lUpnmxjrSq3kyhQoup4OAx4VlmQiCgCmKiA4Rl+QASUSwTATbwjRMTARqmolarhIKeLFMC9klYdsSiqbR0dyA1+3C7/OSX83Tu7YXXySEL+AjNZ/gO089873GxYVHElSMn3uEFDBkU/+b4eEx59T0/DskUXBUVXVGkJztXq97Q1NzPaYtUCgrBJo7CXT34Yn58fqdeGQBWTKRJQh7ZGJN9bj8Xqo1jdV8hdxqgcz1UXTdpGfnZtyyi6WpZcbOXkKrZhBdLrLFCm8MXEewrZGrI+NFlyjWe9zukIEQEBGFgMcJtbfG7NvM0xinQ6hK86arHlESI25HblU344bo+lRbd+edu/Zsp1ZTuDY0Tln044pGES0VURTw+PyEGmJEWptwBHwouoWiGmBZOKplZKdIoLGOWkVlaWyG5MgIYTQ2b+jFsi0uXLhiZpKp78iG8gkZ0lXNCBqCI4ootsu2qXY57JcGF6atXwgA0NCxhppqgSjilR3kLXBYdqNiCx/1hYK/v2HL+nB3Tyfp5QzjwxOs5Eq4Grrwt6/BGY4iOFwgCCCAKIAs2TgtDbVUoJBKoq4kibhF4r2dRCMRJsanGB0aWVbLxc8EJD6nIub9CNQ0HUN0YIoikmmw3lK5vLzAPwnwttjwhchGmvGUK86Sz3M7TudHY7Ho/jVr1zhb21rQNI2l5DKZTJ6KYqDbIhYSCCICNqKt4xRMAl4XDfUxmlsacTiczM3NMTEyqRRXc89LlvE3m63y66OugLVN9vLa+JV/Utev/FPvbYxTdcn49FpMRTgiuOT3+MPh3U0tTb7mlibCkSCiIGAaBrr55vOgKEk4HRKSKGEaFvlcnqXFJVLJ5UK1VHpd0PWv+TFPFB1yKYRBdmHyl9bzz2o1aO9Zz6qiUREdhC0jVLGE3ZYo3i06HPtlj7fT4/OGPF630+lyvgljWeiaRq2qqLVKNafWapO2YbzmxDweRLi8IkiVoGBxUzTIM4OXfyUtv1azx5qe9WQ0g5otoi2OEqjrjBkuuc0UhE7Tsptt7KCALdo2miiQFwQh6RCYc+hKohRtKbrLOXyCQNDtYWby6j9Lw2+sX6iuNY6qmVguF5ogob/5BQn2mxeGiIVDAIdtIekaXoeD5cTUr7nrb6nhCeD8c+dIltOoukIg4Ef0iNxx6I7f1nb/cu1/A+3wBikXky8OAAAAAElFTkSuQmCC';
	const LOGO_32 = 'data:image/png;base64,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';

	// Overlay elements (declared early so log() can reference them)
	let overlayEl = null;
	let overlayStatusEl = null;
	let overlayLogEl = null;

	// Logging function to consistently identify our script
	function log(message, ...args) {
		if (LOGGING_ENABLED) {
			const logMessage = "[" + SCRIPT_NAME + "] " + message;
			console.log(logMessage, ...args);
		}
		// Stream last log line to overlay when visible (replaces, doesn't append)
		if (overlayLogEl) {
			const extra = args.length ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') : '';
			overlayLogEl.textContent = (message + extra).slice(0, 200); // cap length
		}
	}

	// Use URL parameter to maintain state across page reloads
	// rco_sort presence indicates script is running
	function getUrlState() {
		const urlParams = new URLSearchParams(window.location.search);
		const sortValue = urlParams.get('rco_sort');
		return {
			isRunning: sortValue !== null,
			sortValue: sortValue
		};
	}

	function getRunningStateFromUrl() {
		return getUrlState().isRunning;
	}

	function getSortFromUrl() {
		return getUrlState().sortValue;
	}

	function getDaysFromUrl() {
		const urlParams = new URLSearchParams(window.location.search);
		const daysParam = urlParams.get('rco_days');
		if (daysParam !== null) {
			const days = parseInt(daysParam, 10);
			return !isNaN(days) && days >= 0 ? days : 10; // default 10 if invalid
		}
		return 10; // default
	}

	function getDotPreservationFromUrl() {
		const urlParams = new URLSearchParams(window.location.search);
		const dotParam = urlParams.get('rco_dot');
		if (dotParam !== null) {
			return dotParam === 'true';
		}
		return true; // default
	}

	function getDryRunFromUrl() {
		const urlParams = new URLSearchParams(window.location.search);
		const dryRunParam = urlParams.get('rco_dryrun');
		if (dryRunParam !== null) {
			return dryRunParam === 'true';
		}
		return false; // default
	}

	function getSimulateFromUrl() {
		const urlParams = new URLSearchParams(window.location.search);
		const simParam = urlParams.get('rco_simulate');
		if (simParam !== null) {
			return simParam === 'true';
		}
		return true; // default to safe simulation mode
	}

	function updateUrlState(isRunning, sortName, daysToPreserve, preserveDotComments, dryRun) {
		const urlParams = new URLSearchParams(window.location.search);

		if (isRunning && sortName) {
			// Set rco_sort parameter
			urlParams.set('rco_sort', sortName);
			// Set rco_days parameter if provided
			if (daysToPreserve !== undefined) {
				urlParams.set('rco_days', daysToPreserve.toString());
			}
			// Set rco_dot parameter if provided
			if (preserveDotComments !== undefined) {
				urlParams.set('rco_dot', preserveDotComments.toString());
			}
			// Set rco_dryrun parameter if provided
			if (dryRun !== undefined) {
				urlParams.set('rco_dryrun', dryRun.toString());
			}
			// Set rco_simulate parameter
			urlParams.set('rco_simulate', simulate.toString());
		} else {
			// Remove parameters when not running
			urlParams.delete('rco_sort');
			urlParams.delete('rco_days');
			urlParams.delete('rco_dot');
			urlParams.delete('rco_dryrun');
			urlParams.delete('rco_simulate');
		}

		// Update URL without reloading
		const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '') + window.location.hash;
		history.replaceState({}, document.title, newUrl);
	}

	// Initialize running state from URL
	let running = getRunningStateFromUrl();
	daysToPreserve = getDaysFromUrl();
	preserveDotComments = getDotPreservationFromUrl();
	dryRun = getDryRunFromUrl();
	simulate = getSimulateFromUrl();

	// Debug logging
	log("Script loaded - URL parameters:", window.location.search);
	log("Running state from URL:", running);
	log("Current sort from URL:", getSortFromUrl());
	log("Days to preserve from URL:", daysToPreserve);
	log("Preserve dot comments from URL:", preserveDotComments);
	log("Dry run mode from URL:", dryRun);
	log("Simulate mode from URL:", simulate);

	// Progress tracking is no longer needed since we use URL parameters


	/***********************
	 * RATE LIMITING
	 ************************/
	let rateLimitActive = false;
	let lastRateLimitTime = 0;
	let rateLimitMultiplier = 1; // Start at 1x, increases with each 429
	const BASE_RATE_LIMIT_WAIT = 60000; // 60 seconds minimum wait

	// Check if we're currently rate limited
	function isRateLimited() {
		if (!rateLimitActive) return false;

		// Check if enough time has passed to resume
		const now = Date.now();
		const timeSinceLimit = now - lastRateLimitTime;
		const baseWait = BASE_RATE_LIMIT_WAIT * rateLimitMultiplier;
		const cappedWait = Math.min(baseWait, RATE_LIMIT_MAX);

		if (timeSinceLimit >= cappedWait) {
			// Enough time has passed, reset rate limit state
			rateLimitActive = false;
			return false;
		}

		return true; // Still rate limited
	}

	// Wait until rate limit period is over
	async function waitForRateLimit() {
		while (isRateLimited()) {
			log("Still rate limited, waiting...");
			await sleep(5000); // Check every 5 seconds
		}
	}

	/***********************
	 * HELPERS
	 ************************/
	const sleep = ms => new Promise(r => setTimeout(r, ms));
	const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

	// -------- fetch monkey patch --------
	const originalFetch = window.fetch;
	window.fetch = async function(...args) {
		const resp = await originalFetch(...args);
		if (resp.status === 429) {
			log("RATE LIMIT detected (429) via fetch");
			rateLimitActive = true;
			lastRateLimitTime = Date.now();

			// Calculate wait time with exponential backoff (up to max)
			const baseWait = BASE_RATE_LIMIT_WAIT * rateLimitMultiplier;
			const cappedWait = Math.min(baseWait, RATE_LIMIT_MAX);
			rateLimitMultiplier = Math.min(rateLimitMultiplier * 2, RATE_LIMIT_MAX / BASE_RATE_LIMIT_WAIT); // Double multiplier but cap it

			log("Rate limited, setting flag for " + (cappedWait / 1000) + " seconds, multiplier now: " + rateLimitMultiplier);
		} else {
			// Reset multiplier after successful response to avoid permanent slowdown
			if (rateLimitMultiplier > 1) {
				rateLimitMultiplier = 1;
				log("Rate limit multiplier reset after successful response");
			}
		}
		return resp;
	};

	// -------- XMLHttpRequest monkey patch --------
	const OriginalXHR = window.XMLHttpRequest;
	window.XMLHttpRequest = class extends OriginalXHR {
		constructor() {
			super();
			this.addEventListener('readystatechange', () => {
				if (this.readyState === 4 && this.status === 429) {
					log("RATE LIMIT detected (429) via XMLHttpRequest");
					rateLimitActive = true;
					lastRateLimitTime = Date.now();

					// Calculate wait time with exponential backoff (up to max)
					const baseWait = BASE_RATE_LIMIT_WAIT * rateLimitMultiplier;
					const cappedWait = Math.min(baseWait, RATE_LIMIT_MAX);
					rateLimitMultiplier = Math.min(rateLimitMultiplier * 2, RATE_LIMIT_MAX / BASE_RATE_LIMIT_WAIT); // Double multiplier but cap it

					log("Rate limited, setting flag for " + (cappedWait / 1000) + " seconds, multiplier now: " + rateLimitMultiplier);
				} else if (this.readyState === 4 && this.status !== 429 && rateLimitMultiplier > 1) {
					// Reset multiplier after successful response to avoid permanent slowdown
					rateLimitMultiplier = 1;
					log("Rate limit multiplier reset after successful XHR response");
				}
			});
		}
	};


	/***********************
	 * DETECT SORT ON PAGE
	 ************************/
	function getCurrentSort() {
		try {
			// First try to get from URL
			const u = new URL(location.href);
			const urlSort = u.searchParams.get("sort");
			if (urlSort) {
				log("getCurrentSort(): Found in URL:", urlSort);
				return urlSort;
			}

			// If not in URL, try to detect from the UI
			const selectedSortElement = document.querySelector('.dropdown.lightdrop .selected, .dropdown.sorts .selected, [data-sort-direction].active');
			if (selectedSortElement) {
				const sortText = selectedSortElement.textContent.trim().toLowerCase();
				log("getCurrentSort(): Found in UI element:", sortText);
				// Verify it's a valid sort option
				if (SORTS.includes(sortText)) {
					return sortText;
				}
			}

			// Default to "new" if we can't determine
			log("getCurrentSort(): Defaulting to 'new'");
			return "new";
		} catch {
			log("getCurrentSort(): Exception, defaulting to 'new'");
			return "new";
		}
	}

	function gotoSort(sort) {
		log("Switching sort →", sort, "via URL navigation");

		const u = new URL(location.href);
		u.searchParams.set("sort", sort);

		// Preserve all rco state parameters across navigation
		for (const key of ['rco_sort', 'rco_days', 'rco_dot', 'rco_dryrun', 'rco_simulate']) {
			const val = new URLSearchParams(window.location.search).get(key);
			if (val !== null) u.searchParams.set(key, val);
		}

		log("Final URL before navigation:", u.toString());
		if (u.toString() !== location.href) {
			log("Navigating to:", u.toString());
			location.href = u.toString();
		} else {
			log("URL unchanged, no navigation needed");
		}
		return false;
	}


	/***********************
	 * DATE FILTERING
	 ************************/

	function parseAgeDays(text) {
		const m = text.toLowerCase().match(/^(\d+)\s*(minute|hour|day|month|year)s?\s+ago$/);
		if (!m) return null;
		const n = parseInt(m[1], 10);
		switch (m[2]) {
			case 'minute': return n / 1440;
			case 'hour':   return n / 24;
			case 'day':    return n;
			case 'month':  return n * 30;
			case 'year':   return n * 365;
			default:       return null;
		}
	}

	function shouldSkipCommentByDate(commentElement) {
		const timeEl = commentElement.querySelector('time[datetime]');
		if (!timeEl) {
			log('shouldSkipCommentByDate: No time element, preserving');
			return true;
		}

		// Strategy 1: parse the human-readable text ("10 days ago") — avoids timezone issues
		const text = (timeEl.textContent || '').trim();
		if (text) {
			const age = parseAgeDays(text);
			if (age !== null) {
				log('shouldSkipCommentByDate: text="' + text + '" ageDays=' + age + ' preserveDays=' + daysToPreserve);
				return age <= daysToPreserve;
			}
		}

		// Strategy 2: fall back to datetime attribute parsing
		try {
			const raw = (timeEl.getAttribute('datetime') || '').trim();
			if (!raw) {
				log('shouldSkipCommentByDate: Empty datetime, preserving');
				return true;
			}
			const commentDate = new Date(raw);
			if (isNaN(commentDate.getTime())) {
				log('shouldSkipCommentByDate: Unparseable datetime "' + raw + '", preserving');
				return true;
			}
			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - daysToPreserve);
			log('shouldSkipCommentByDate: fallback datetime comment=' + commentDate.toISOString() + ' cutoff=' + cutoff.toISOString());
			return commentDate >= cutoff;
		} catch (e) {
			log('shouldSkipCommentByDate: Error:', e);
			return true;
		}
	}

	function shouldSkipCommentByDot(commentElement) {
		if (!preserveDotComments) return false;

		try {
			// Narrow to the content area – prefer .usertext-body, fall back to .md
			const body = commentElement.querySelector('.usertext-body');
			const md = body || commentElement.querySelector('.md');
			if (!md) {
				log('shouldSkipCommentByDot: No .md found, not preserving');
				return false;
			}

			// Use innerText so block elements (<p>, <li>, etc.) produce \n between them.
			// textContent concatenates text nodes without separators, which makes dot-on-its-own-line
			// detection impossible when Reddit minifies the HTML.
			let raw = md.innerText || md.textContent || '';
			if (!raw.trim()) {
				log('shouldSkipCommentByDot: Empty comment text, not preserving');
				return false;
			}

			raw = raw.replace(/\r\n?/g, '\n');
			const lines = raw.split('\n')
				.map(l => l.replace(/[\s\u00A0\u2000-\u200A\u202F\u205F\u3000]+/g, ''))
				.filter(l => l.length > 0);
			if (!lines.length) {
				log('shouldSkipCommentByDot: No non-empty lines after cleaning, not preserving');
				return false;
			}

			if (lines[lines.length - 1] === '.') {
				log('shouldSkipCommentByDot: Preserving comment ending with dot');
				return true;
			}

			return false;
		} catch (e) {
			log('shouldSkipCommentByDot: Error:', e);
			return false;
		}
	}

	/***********************
	 * COMMENT DETECTION
	 ************************/
	function getDeleteButtons() {
		// More robust selector using data attribute and class
		const allButtons = [...document.querySelectorAll("a[data-event-action='delete'], a.togglebutton")]
			.filter(el => /delete/i.test(el.textContent));

		// Additionally filter to skip comments that are too recent
		const filtered = allButtons.filter(deleteBtn => {
				// Find the comment element that contains this delete button
				const commentElement = deleteBtn.closest('.comment, .thing, .entry, [id^=t1_]');
				if (!commentElement) {
					return true; // If we can't find the comment element, include the button
				}

				// Check if this comment should be skipped based on date or dot preservation
				const skipByDate = shouldSkipCommentByDate(commentElement);
				const skipByDot = shouldSkipCommentByDot(commentElement);
				const shouldSkip = skipByDate || skipByDot;

				if (shouldSkip) {
					log(`getDeleteButtons: Skipping comment (date: ${skipByDate}, dot: ${skipByDot})`);
				}

				return !shouldSkip;
			});

		log(`getDeleteButtons: ${allButtons.length} total buttons, ${filtered.length} after filtering`);
		return filtered;
	}

	async function waitForComments() {
		const start = Date.now();
		while (Date.now() - start < WAIT_FOR_COMMENTS_MS && running) {
			// Wait if we're currently rate limited
			await waitForRateLimit();

			// Check for both delete buttons and comment containers to ensure page is loaded
			const del = getDeleteButtons();
			const comments = document.querySelectorAll('div.comment, div.comment-body, .thing.comment');

			if (del.length > 0) return del;
			// If we see comments but no delete buttons, they might still be loading
			if (comments.length > 0) {
				await sleep(1500); // Wait a bit more for buttons to appear
				continue;
			}
			await sleep(1000);
		}
		return [];
	}


	/***********************
	 * DELETE SINGLE COMMENT
	 ************************/
	async function deleteComment(btn) {
		let success = false;

		// Dry-run mode: log action without actually deleting
		if (dryRun) {
			log("DRY-RUN: Would delete comment");
			return true;
		}

		while (!success && running) {
			// Wait if we're currently rate limited
			await waitForRateLimit();

			try {
				btn.click();
				await sleep(300);

				if (simulate) {
					// Simulation mode: click "No" on confirmation to see what would be deleted
					const no = [...document.querySelectorAll("a.no, a.cancel, .option a")]
						.find(e => /^(no|cancel)$/i.test(e.textContent.trim()));
					const yes = [...document.querySelectorAll("a.yes, .option.error.active a")]
						.find(e => e.textContent.trim().toLowerCase() === "yes");
					if (no) {
						no.click();
						log("SIMULATE: Clicked No on confirmation — comment NOT deleted");
					} else if (yes) {
						// If there's a Yes button but no No button, try clicking the cancel/close action
						const cancel = document.querySelector('.delete-field.cancel a, a.cancel');
						if (cancel) {
							cancel.click();
							log("SIMULATE: Clicked cancel");
						} else {
							log("SIMULATE: Found Yes button but no No/Cancel button, skipping");
						}
					} else {
						log("SIMULATE: No confirmation dialog found");
					}
					await sleep(rand(SHORT_DELAY_MIN, SHORT_DELAY_MAX));
					return true;
				}

				const yes = [...document.querySelectorAll("a.yes, .option.error.active a")]
					.find(e => e.textContent.trim().toLowerCase() === "yes");

				if (!yes) {
					log("No confirmation found; skipping.");
					return false;
				}

				yes.click();
				log("Deleted comment");
				await sleep(rand(SHORT_DELAY_MIN, SHORT_DELAY_MAX));
				return true;

			} catch (err) {
				log("Error during delete:", err);
				// Use a more reasonable delay for errors
				const cooldown = rand(5000, 30000); // 5-30 seconds instead of 30s-15m
				log("Waiting for " + (cooldown / 1000) + " seconds before retry");
				await sleep(cooldown);
			}
		}
		return false;
	}


	/***********************
	 * PROCESS PAGE
	 ************************/
	async function processPage() {
		if (!running) return false;

		// Wait if we're currently rate limited
		await waitForRateLimit();

		let deletes = getDeleteButtons();

		if (deletes.length === 0) {
			// wait for lazy-loaded comments
			deletes = await waitForComments();
		}

		// Check if there are actually comments on the page, not just delete buttons
		const commentElements = document.querySelectorAll('div.comment, div.comment-body, .thing.comment');
		if (deletes.length === 0 && commentElements.length === 0) {
			return false; // no comments to delete
		}

		if (deletes.length === 0) {
			// Comments exist but no delete buttons (might be someone else's comments)
			log("Comments found but no delete buttons available");
			// Update status to show current state
			// Check for next page or load more even if no deletes found
			const nextBtn = document.querySelector("span.next-button a");
			if (nextBtn && running) {
				log("Next page →", nextBtn.href);
				location.href = nextBtn.href;
				return true;
			}
			const more = document.querySelector(".morecomments, .load-more-comments");
			if (more && running) {
				log("Loading more comments...");
				more.scrollIntoView();
				more.click(); // Actually click the load more button
				await sleep(3000); // Wait for content to load
				return true;
			}
			return false; // no delete buttons found
		}

		if (dryRun) {
			log("DRY-RUN: Found", deletes.length, "comments that would be deleted");
		} else if (simulate) {
			log("SIMULATE: Found", deletes.length, "comments that would be targeted");
		} else {
			log("Found", deletes.length, "comments to delete");
		}
		updateOverlay(getCurrentSort() + ' sort', deletes.length + ' comments found');

		let deleted = 0;
		// Generate the initial pause target once (not per iteration like before)
		let nextPauseTarget = rand(LONG_DELAY_AFTER[0], LONG_DELAY_AFTER[1]);

		for (const btn of deletes) {
			if (!running) break;

			// Wait for potential rate limit before each deletion
			await waitForRateLimit();

			const success = await deleteComment(btn);
			if (success) {
				deleted++;
				updateOverlay(getCurrentSort() + ' sort', deleted + ' / ' + deletes.length + ' comments processed');
			}

			// periodic long pause to avoid rate limit
			if (deleted >= nextPauseTarget) {
				const p = rand(LONG_DELAY_MS[0], LONG_DELAY_MS[1]);
				log("Long pause after", deleted, "deletions, waiting", p / 1000, "seconds");
				updateOverlay(getCurrentSort() + ' sort', 'Rate limit pause... (' + (p / 1000).toFixed(0) + 's)');
				await sleep(p);
				// Set next pause target: another random interval from the current count
				nextPauseTarget = deleted + rand(LONG_DELAY_AFTER[0], LONG_DELAY_AFTER[1]);
			}
		}

		// handle old reddit pagination
		const nextBtn = document.querySelector("span.next-button a");
		if (nextBtn && running) {
			log("Next page →", nextBtn.href);
			location.href = nextBtn.href;
			return true;
		}

		// handle infinite scroll
		const more = document.querySelector(".morecomments, .load-more-comments");
		if (more && running) {
			log("Loading more comments...");
			more.scrollIntoView();
			more.click(); // Actually click the load more button
			await sleep(3000); // Wait for content to load
			return true;
		}

		return true; // We processed some comments
	}


	/***********************
	 * PER-SORT EXECUTION
	 ************************/
	async function runSort(sort) {
		// Wait if we're currently rate limited
		await waitForRateLimit();

		// Check if we're already on the correct sort
		const cur = getCurrentSort();
		if (cur !== sort) {
			log("Current sort is", cur, "but need", sort, "waiting before navigation to prevent rate limits");
			// Wait before navigation to prevent rate limiting
			await sleep(5000); // 5 second wait before navigation (reduced from 30 seconds)
			gotoSort(sort);
			// Wait a bit to allow navigation to start before this script context ends
			await sleep(5000); // 5 second wait (increased from 2 seconds)
			return false; // let reload happen since we're using URL navigation
		} else {
			log("Already on correct sort:", sort, "starting processing immediately");
		}

		log("Processing sort:", sort);

		// Wait for comments to appear on the current page
		const initialDeletes = getDeleteButtons();
		if (initialDeletes.length === 0) {
			log("No delete buttons found, waiting for comments to load...");
			const deletesAfterWait = await waitForComments();
			if (deletesAfterWait.length === 0) {
				log("Still no comments found after waiting for sort:", sort);
				return true; // Consider this sort complete if no comments found
			}
		}

		// Repeatedly delete until none left
		while (running) {
			// Wait if we're currently rate limited
			await waitForRateLimit();

			const didWork = await processPage();
			if (!running) break;
			if (!didWork) break;
			await sleep(3000); // Increased from 800ms
		}

		log("Sort complete:", sort);
		return true;
	}




	/*************************
	 * MAIN LOOP
	 ************************/
	async function main(isFreshStart = false) {
		// Always process all 4 sorts
		const activeSorts = SORTS;
		log("Processing all sorts:", activeSorts);

		// Determine if we're starting fresh or resuming
		const urlHasRunningState = getRunningStateFromUrl();
		let idx = 0;

		if (urlHasRunningState && !isFreshStart) {
			// Actual resume: page loaded with URL params, no modal was shown
			log("Resuming from URL state");
			const urlSort = getSortFromUrl();
			if (urlSort && activeSorts.includes(urlSort)) {
				idx = activeSorts.indexOf(urlSort);
				log("Resuming from sort:", urlSort, "at index:", idx);
			} else if (urlSort) {
				// If the URL sort isn't in active sorts, find the next valid one
				const urlSortOriginalIndex = SORTS.indexOf(urlSort);
				if (urlSortOriginalIndex !== -1) {
					for (let i = 0; i < activeSorts.length; i++) {
						const activeSortOriginalIndex = SORTS.indexOf(activeSorts[i]);
						if (activeSortOriginalIndex >= urlSortOriginalIndex) {
							idx = i;
							log("URL sort not in selected sorts, resuming from:", activeSorts[idx], "at index:", idx);
							break;
						}
					}
				}
			}
		} else {
			// Fresh start - always start from the first sort to ensure all sorts are processed
			log("Starting fresh — processing all sorts from the beginning");
			idx = 0;
		}

		// Safety check: ensure idx is valid
		if (idx < 0 || idx >= activeSorts.length) {
			log("ERROR: Invalid idx", idx, "for activeSorts length", activeSorts.length, "- resetting to 0");
			idx = 0;
		}

		log("Starting from sort index: " + idx + " (" + (activeSorts[idx] || 'unknown') + ")");
		log("Active sorts:", activeSorts);

		// Update status display

		// Track which sorts have been completed to skip them if we encounter them again
		const completedSorts = new Set();

		// Mark all previous sorts as completed if resuming from a middle position
		// (only on genuine resume, not on fresh start — fresh start must process ALL sorts)
		if (urlHasRunningState && !isFreshStart) {
			for (let i = 0; i < idx; i++) {
				if (i < activeSorts.length) {
					completedSorts.add(activeSorts[i]);
				}
			}
		}

		while (running) {
			try {
				// Wait if we're currently rate limited
				await waitForRateLimit();

				// Find next non-completed sort
				while (idx < activeSorts.length && completedSorts.has(activeSorts[idx])) {
					log("Skipping already completed sort:", activeSorts[idx]);
					idx++;
				}

				if (idx >= activeSorts.length) {
					log("ALL SELECTED SORTS PROCESSED — no more comments.");
					running = false;
					// Update status and button state when all sorts are complete
					updateUrlState(false, '', undefined, preserveDotComments, dryRun);
					updateButtonState();
					hideOverlay();
					log("All selected sorts completed, clearing state");
					break;
				}

				const sort = activeSorts[idx];

		log("Processing sort: " + sort + " at index: " + idx);
			updateOverlay('Processing ' + sort + ' sort', 'Searching for comments...');
			const finished = await runSort(sort);
				if (!running) break;

				if (finished) {
					completedSorts.add(sort);
					idx++;
					log("Finished " + sort + " sort, advancing to index: " + idx);
					// Update URL state for page reload recovery
					// Get next sort to process, or empty if done
					let nextSort = "";
					if (idx < activeSorts.length) {
						nextSort = activeSorts[idx];
					}
					updateUrlState(running, nextSort, daysToPreserve, preserveDotComments, dryRun);
					log("Updated URL state - running: " + running + ", next sort: " + nextSort);
					// Update progress in status display
				}

				await sleep(5000);
			} catch (error) {
				log("Error in main loop:", error);
				// Update status to show error
				// Wait before continuing to avoid getting stuck in an error loop
				await sleep(10000);
				// Resume status after error pause
			}
		}
	}







	/***********************
	 * CONFIRMATION MODAL
	 ************************/
	function showConfirmationModal() {
		// Remove any existing modal first
		const existingModals = document.querySelectorAll('.rco-confirmation-modal');
		for (const existingModal of existingModals) {
			try {
				existingModal.remove();
			} catch (e) {
				// Ignore errors
			}
		}

		const modal = document.createElement("div");
		modal.className = 'rco-confirmation-modal';
		modal.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.7);
			display: flex;
			justify-content: center;
			align-items: center;
			z-index: 999997;
		`;

		const content = document.createElement("div");
		content.style.cssText = `
			background: white;
			padding: 20px;
			border-radius: 8px;
			min-width: 300px;
			max-width: 500px;
			box-shadow: 0 4px 15px rgba(0,0,0,0.3);
		`;

		const title = document.createElement("h3");
		title.textContent = "⚠️ Confirm Bulk Comment Deletion";
		// Modal logo
		const modalLogo = document.createElement("img");
		modalLogo.src = LOGO_32;
		modalLogo.alt = '';
		Object.assign(modalLogo.style, {
			width: '24px', height: '26px',
			display: 'block',
			margin: '0 auto 8px auto'
		});
		content.appendChild(modalLogo);
		title.style.cssText = "margin-top: 0; margin-bottom: 15px; color: #d00;";
		content.appendChild(title);

		const warning = document.createElement("p");
		const modeText = simulate ? "SIMULATION MODE — comments will NOT be deleted" : "Comments WILL be permanently deleted";
		warning.innerHTML = `[${modeText}]<br><br>This will process all your Reddit comments across all sort types (new, hot, top, controversial). Comments from the last <span id='days-display'>${daysToPreserve}</span> days will be preserved. You can also preserve comments ending with a dot (.) on their own line.`;
		warning.style.cssText = "margin-bottom: 10px; line-height: 1.4;";
		content.appendChild(warning);

		// Days input
		const daysContainer = document.createElement("div");
		daysContainer.style.cssText = "margin-bottom: 20px; display: flex; align-items: center; gap: 10px;";

		const daysLabel = document.createElement("label");
		daysLabel.textContent = "Preserve comments from the last:";
		daysLabel.style.cssText = "font-weight: bold;";

		const daysInput = document.createElement("input");
		daysInput.type = "number";
		daysInput.min = "0";
		daysInput.max = "365";
		daysInput.value = daysToPreserve;
		daysInput.style.cssText = "padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; width: 70px;";

		const daysSuffix = document.createElement("span");
		daysSuffix.textContent = "days";

		daysContainer.appendChild(daysLabel);
		daysContainer.appendChild(daysInput);
		daysContainer.appendChild(daysSuffix);
		content.appendChild(daysContainer);

		// Update display and variable when input changes
		daysInput.addEventListener('input', () => {
			const newValue = parseInt(daysInput.value, 10);
			if (!isNaN(newValue) && newValue >= 0) {
				daysToPreserve = newValue;
				document.getElementById('days-display').textContent = newValue;
			}
		});

		// Dot preservation checkbox
		const dotContainer = document.createElement("div");
		dotContainer.style.cssText = "margin-bottom: 20px; display: flex; align-items: center; gap: 10px;";

		const dotCheckbox = document.createElement("input");
		dotCheckbox.type = "checkbox";
		dotCheckbox.id = "dot-preservation";
		dotCheckbox.checked = preserveDotComments;
		dotCheckbox.style.cssText = "width: 18px; height: 18px;";

		const dotLabel = document.createElement("label");
		dotLabel.htmlFor = "dot-preservation";
		dotLabel.textContent = "Preserve comments ending with a dot (.) on their own line";
		dotLabel.style.cssText = "font-weight: bold; cursor: pointer;";

		dotContainer.appendChild(dotCheckbox);
		dotContainer.appendChild(dotLabel);
		content.appendChild(dotContainer);

		// Update variable when checkbox changes
		dotCheckbox.addEventListener('change', () => {
			preserveDotComments = dotCheckbox.checked;
			log("Dot preservation setting changed to:", preserveDotComments);
		});

		// Dry-run checkbox
		const dryRunContainer = document.createElement("div");
		dryRunContainer.style.cssText = "margin-bottom: 20px; display: flex; align-items: center; gap: 10px;";

		const dryRunCheckbox = document.createElement("input");
		dryRunCheckbox.type = "checkbox";
		dryRunCheckbox.id = "dry-run";
		dryRunCheckbox.checked = dryRun;
		dryRunCheckbox.style.cssText = "width: 18px; height: 18px;";

		const dryRunLabel = document.createElement("label");
		dryRunLabel.htmlFor = "dry-run";
		dryRunLabel.textContent = "Dry-run mode: log actions without actually deleting";
		dryRunLabel.style.cssText = "font-weight: bold; cursor: pointer;";

		dryRunContainer.appendChild(dryRunCheckbox);
		dryRunContainer.appendChild(dryRunLabel);
		content.appendChild(dryRunContainer);

		// Update variable when checkbox changes
		dryRunCheckbox.addEventListener('change', () => {
			dryRun = dryRunCheckbox.checked;
			log("Dry-run setting changed to:", dryRun);
		});

		// Simulation mode checkbox (only relevant when dry-run is off)
		const simContainer = document.createElement("div");
		simContainer.style.cssText = "margin-bottom: 20px; display: flex; align-items: center; gap: 10px;";

		const simCheckbox = document.createElement("input");
		simCheckbox.type = "checkbox";
		simCheckbox.id = "simulate-mode";
		simCheckbox.checked = simulate;
		simCheckbox.style.cssText = "width: 18px; height: 18px;";

		const simLabel = document.createElement("label");
		simLabel.htmlFor = "simulate-mode";
		simLabel.textContent = "Simulation mode: click No on confirmation (safe)";
		simLabel.style.cssText = "font-weight: bold; cursor: pointer;";

		simContainer.appendChild(simCheckbox);
		simContainer.appendChild(simLabel);
		content.appendChild(simContainer);

		// Update variable when checkbox changes
		simCheckbox.addEventListener('change', () => {
			simulate = simCheckbox.checked;
			log("Simulation mode changed to:", simulate);
		});

		const note = document.createElement("p");
		note.textContent = "Starting from current sort: " + getCurrentSort();
		note.style.cssText = "margin-bottom: 20px; font-style: italic;";
		content.appendChild(note);

		const buttonContainer = document.createElement("div");
		buttonContainer.style.cssText = "display: flex; justify-content: flex-end; gap: 10px;";

		const confirmBtn = document.createElement("button");
		confirmBtn.textContent = "Confirm & Start Deleting";
		confirmBtn.style.cssText = `
			padding: 8px 16px;
			background: #ff4500;
			color: white;
			border: none;
			border-radius: 4px;
			cursor: pointer;
		`;

		const cancelBtn = document.createElement("button");
		cancelBtn.textContent = "Cancel";
		cancelBtn.style.cssText = `
			padding: 8px 16px;
			background: #ccc;
			color: #333;
			border: none;
			border-radius: 4px;
			cursor: pointer;
		`;

		buttonContainer.appendChild(cancelBtn);
		buttonContainer.appendChild(confirmBtn);
		content.appendChild(buttonContainer);
		modal.appendChild(content);

		// Add modal to document
		document.body.appendChild(modal);

		// Handle cancel button
		cancelBtn.onclick = () => {
			try {
				modal.remove();
			} catch (e) {
				// Ignore errors
			}
			// Keep button as "Start Deleting"
		};

		// Handle confirm button
		confirmBtn.onclick = () => {
			if (mainRunning) {
				log("A deletion session is already active, ignoring confirm");
				return;
			}
			try {
				modal.remove();
			} catch (e) {
				// Ignore errors
			}
			running = true;
			updateButtonState();

			// Calculate starting sort and update URL
			const currentSort = getCurrentSort();
			updateUrlState(running, currentSort, daysToPreserve, preserveDotComments, dryRun);

			showOverlay();
			updateOverlay('Starting...', 'Processing all 4 sort types');
			mainRunning = true;
			main(true).finally(() => { mainRunning = false; hideOverlay(); }); // true = fresh start — process ALL 4 sorts
		};
	}

	/***********************
	 * OVERLAY — covers the page while script is running
	 ************************/
	function showOverlay() {
		if (overlayEl) return; // already showing

		overlayEl = document.createElement("div");
		overlayEl.id = 'rco-overlay';
		Object.assign(overlayEl.style, {
			position: 'fixed',
			top: '0', left: '0', width: '100%', height: '100%',
			background: 'rgba(0,0,0,0.55)',
			zIndex: '999998',
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			fontFamily: 'Arial, sans-serif'
		});

		const panel = document.createElement("div");
		Object.assign(panel.style, {
			background: '#fff',
			borderRadius: '10px',
			padding: '30px 40px',
			maxWidth: '500px',
			textAlign: 'center',
			boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
		});

		const logo = document.createElement("img");
		logo.src = LOGO_48;
		logo.alt = 'Reddit Comments Overkill';
		Object.assign(logo.style, {
			width: '120px',
			height: 'auto',
			marginBottom: '10px',
			display: 'block',
			marginLeft: 'auto',
			marginRight: 'auto'
		});
		panel.appendChild(logo);

		const title = document.createElement("div");
		title.textContent = 'Reddit Comments Overkill';
		Object.assign(title.style, {
			fontSize: '20px',
			fontWeight: 'bold',
			color: '#d00',
			marginBottom: '12px'
		});
		panel.appendChild(title);

		overlayStatusEl = document.createElement("div");
		Object.assign(overlayStatusEl.style, {
			fontSize: '14px',
			color: '#333',
			marginBottom: '20px',
			lineHeight: '1.5'
		});
		overlayStatusEl.textContent = 'Starting...';
		panel.appendChild(overlayStatusEl);

		overlayLogEl = document.createElement("div");
		Object.assign(overlayLogEl.style, {
			fontSize: '12px',
			color: '#555',
			marginBottom: '12px',
			minHeight: '1.2em',
			fontFamily: 'monospace',
			wordBreak: 'break-all'
		});
		panel.appendChild(overlayLogEl);

		const stopBtn = document.createElement("button");
		stopBtn.textContent = 'Stop Deleting';
		Object.assign(stopBtn.style, {
			padding: '10px 24px',
			background: '#d00',
			color: '#fff',
			border: 'none',
			borderRadius: '6px',
			fontSize: '14px',
			fontWeight: 'bold',
			cursor: 'pointer',
			marginTop: '8px'
		});
		stopBtn.onclick = () => {
			running = false;
			updateUrlState(false, '', undefined, preserveDotComments, dryRun);
			updateButtonState();
			hideOverlay();
		};
		panel.appendChild(stopBtn);

		overlayEl.appendChild(panel);
		document.body.appendChild(overlayEl);
	}

	function updateOverlay(status, detail) {
		if (!overlayStatusEl) return;
		let html = '';
		if (status) html += '<strong>' + escapeHtml(status) + '</strong>';
		if (detail) html += '<br>' + escapeHtml(detail);
		overlayStatusEl.innerHTML = html;
	}

	function hideOverlay() {
		if (overlayEl) {
			try { overlayEl.remove(); } catch (e) { /* ignore */ }
			overlayEl = null;
			overlayStatusEl = null;
			overlayLogEl = null;
		}
	}

	function escapeHtml(str) {
		const d = document.createElement('div');
		d.textContent = str;
		return d.innerHTML;
	}

	/***********************
	 * BUTTON
	 ************************/
	const btn = document.createElement("button");
	const btnLogo = document.createElement("img");
	btnLogo.src = LOGO_32;
	btnLogo.alt = '';
	Object.assign(btnLogo.style, {
		width: '20px', height: '22px',
		marginRight: '6px', verticalAlign: 'middle'
	});
	const btnSpan = document.createElement("span");
	btnSpan.style.cssText = 'font-weight: bold; font-size: 11px; opacity: 0.8; margin-right: 6px;';
	btnSpan.textContent = 'Reddit Comments Overkill';
	const btnText = document.createElement("span");
	btnText.className = 'btn-text';
	btnText.textContent = 'Start Deleting';
	btn.appendChild(btnLogo);
	btn.appendChild(btnSpan);
	btn.appendChild(btnText);
	Object.assign(btn.style, {
		position: "fixed",
		bottom: "15px",
		right: "15px",
		padding: "10px 14px",
		background: "#ff4500",
		color: "#fff",
		border: "none",
		borderRadius: "6px",
		fontSize: "14px",
		cursor: "pointer",
		zIndex: 999999,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
		transition: "all 0.2s ease"
	});
	document.body.appendChild(btn);

	// Update button visual state
	function updateButtonState() {
		const btnText = btn.querySelector('.btn-text');
		if (!btnText) return;
		if (running) {
			btnText.textContent = "Stop Deleting";
			btn.style.background = "#d00";
			btn.style.boxShadow = "0 2px 8px rgba(208, 0, 0, 0.5)";
			// Add pulsing animation when running
			btn.style.animation = "pulse 1.5s infinite";
		} else {
			btnText.textContent = "Start Deleting";
			btn.style.background = "#ff4500";
			btn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
			btn.style.animation = "none";
		}
	}

	// Add CSS for pulsing animation
	const style = document.createElement('style');
	style.textContent = `
		@keyframes pulse {
			0% { box-shadow: 0 0 0 0 rgba(208, 0, 0, 0.7); }
			70% { box-shadow: 0 0 0 6px rgba(208, 0, 0, 0); }
			100% { box-shadow: 0 0 0 0 rgba(208, 0, 0, 0); }
		}
	`;
	document.head.appendChild(style);

	// Set initial button state based on URL running state
	running = getRunningStateFromUrl();
	updateButtonState();

	// Guard to prevent multiple concurrent main() loops
	let mainRunning = false;

	btn.onclick = () => {
		if (!running) {
			// Prevent starting another main() instance if one is still active
			if (mainRunning) {
				log("A deletion session is already active, ignoring click");
				return;
			}
			// Starting fresh - check if we need confirmation
			if (getRunningStateFromUrl()) {
				// Already has rco_sort parameter - resume without confirmation
				running = true;
				updateButtonState();
				mainRunning = true;
				main().finally(() => { mainRunning = false; });
			} else {
				// Fresh start - show confirmation modal
				showConfirmationModal();
			}
		} else {
			// Stopping
			running = false;
			updateUrlState(false, '', undefined, preserveDotComments, dryRun);
			updateButtonState();
			hideOverlay();
		}
	};

	// Check if the script should start automatically based on URL state
	if (getRunningStateFromUrl()) {
		log("Resuming from previous state");
		running = true; // Ensure running is true when resuming
		// Update button to reflect running status
		updateButtonState();
		showOverlay();
		updateOverlay('Resuming...', 'Continuing from previous session');
		mainRunning = true;
		main().finally(() => { mainRunning = false; hideOverlay(); });
	}

})();

