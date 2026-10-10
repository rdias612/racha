// Card admin de horários reais do jogo (Plano 38): o racha não começa 19h em
// ponto nem termina 20h em ponto — o admin registra aqui a janela REAL usada
// pela importação de clipes (navega os slots cobertos e filtra pela janela).
// Estado do form é da seção; ao salvar/limpar com sucesso chama onAtualizar()
// (a rota recarrega a partida) — padrão do card de disparo (SecaoDisparoClipes).

import { useState } from 'react';
import { Clock } from 'lucide-react';
import { Botao } from './ui/Botao';
import { useJogadorLogado } from '../hooks/useJogadorLogado';
import { salvarHorariosReaisPartida, type Partida } from '../lib/partidas';
import { horarioBRTDeIso } from '../lib/formatacao';
import { formatarMensagemErro } from '../lib/erros';

export interface SecaoHorariosReaisPartidaProps {
  partida: Partida;
  /** Recarrega a partida (reflete os horários gravados no cabeçalho/estado). */
  onAtualizar: () => void;
}

export function SecaoHorariosReaisPartida({ partida, onAtualizar }: SecaoHorariosReaisPartidaProps) {
  const jogadorLogado = useJogadorLogado();
  const [inicio, setInicio] = useState(() => (partida.inicio_real ? horarioBRTDeIso(partida.inicio_real) : ''));
  const [fim, setFim] = useState(() => (partida.fim_real ? horarioBRTDeIso(partida.fim_real) : ''));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const temHorariosGravados = Boolean(partida.inicio_real && partida.fim_real);

  // Mesma regra da RPC (migration 120): ambos preenchidos, ou ambos vazios.
  function validar(): string | null {
    if (!inicio !== !fim) return 'Informe início e término juntos, ou limpe os dois.';
    if (inicio && fim <= inicio) return 'O término precisa ser depois do início.';
    return null;
  }

  async function salvar(limpar: boolean) {
    if (!jogadorLogado) return;
    const erroValidacao = limpar ? null : validar();
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      // Limpar = ambos null; salvar = os dois campos (vazios também limpam —
      // espelha a semântica "ambos preenchidos ou ambos NULL" da RPC).
      const novoInicio = limpar || !inicio ? null : inicio;
      const novoFim = limpar || !fim ? null : fim;
      await salvarHorariosReaisPartida(partida.id, jogadorLogado.id, novoInicio, novoFim);
      if (limpar) {
        setInicio('');
        setFim('');
      }
      onAtualizar();
    } catch (e) {
      setErro(formatarMensagemErro(e, 'Não foi possível salvar os horários.'));
    } finally {
      setSalvando(false);
    }
  }

  const classeInput =
    'w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz font-mono shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2';

  return (
    <section className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo space-y-3">
      <div>
        <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
          Horários reais do jogo
        </h3>
        <p className="text-xs text-giz-fraco mt-0.5">
          Janela usada pela importação de clipes: sem horários, importa o slot do horário previsto
          inteiro (19h).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1">
            Início
          </span>
          <input
            type="time"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className={classeInput}
          />
        </label>
        <label className="block">
          <span className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1">
            Término
          </span>
          <input
            type="time"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className={classeInput}
          />
        </label>
      </div>

      {erro && <p className="text-xs font-mono text-perigo-texto">{erro}</p>}

      <div className="grid grid-cols-2 gap-2">
        <Botao onClick={() => salvar(false)} disabled={salvando}>
          <Clock className="size-3.5" aria-hidden="true" />
          {salvando ? 'Salvando…' : 'Salvar'}
        </Botao>
        <Botao variante="secundario" onClick={() => salvar(true)} disabled={salvando || !temHorariosGravados}>
          Limpar
        </Botao>
      </div>
    </section>
  );
}
