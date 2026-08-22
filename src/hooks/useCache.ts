import { useCallback, useEffect, useState } from 'react';
import { formatarMensagemErro } from '../lib/erros';

// Cache em memória a nível de módulo: sobrevive ao unmount/remount das rotas
// (troca de abas) e vive pelo tempo de vida da sessão no SPA.
const cache = new Map<string, unknown>();

// Promises em voo por chave: dedupe de buscas concorrentes para a mesma chave.
const emVoo = new Map<string, Promise<unknown>>();

// Geração por chave: incrementada a cada invalidação para que uma busca iniciada
// ANTES de uma mutação não repovoque o cache com dado obsoleto ao resolver.
const geracoes = new Map<string, number>();

/**
 * Remove uma chave do cache. Chame após mutações (ex: excluir partida) para
 * garantir que a próxima visita busque na rede em vez de servir dado obsoleto.
 */
export function invalidarCache(chave: string): void {
  geracoes.set(chave, (geracoes.get(chave) ?? 0) + 1);
  emVoo.delete(chave);
  cache.delete(chave);
}

function lerCache<T>(chave: string): T | undefined {
  return cache.get(chave) as T | undefined;
}

function executar<T>(chave: string, buscar: () => Promise<T>): Promise<T> {
  const emAndamento = emVoo.get(chave);
  if (emAndamento) return emAndamento as Promise<T>;

  const geracao = geracoes.get(chave) ?? 0;
  const promessa = buscar().then(
    (resultado) => {
      emVoo.delete(chave);
      if ((geracoes.get(chave) ?? 0) === geracao) {
        cache.set(chave, resultado);
      }
      return resultado;
    },
    (motivo) => {
      emVoo.delete(chave);
      throw motivo;
    }
  );

  emVoo.set(chave, promessa);
  return promessa;
}

interface EstadoCache<T> {
  chave: string;
  dados: T | undefined;
  erro: string | null;
}

export interface RetornoUseCache<T> {
  dados: T | undefined;
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
}

/**
 * Hook de cache em memória com semântica stale-while-revalidate, sem libs externas.
 * Primeira visita: `carregando` (skeleton) até a resposta chegar. Revisitas:
 * renderizam o cache imediatamente e revalidam em background. Falhas de
 * revalidação com dados em tela são silenciosas (a tela continua utilizável);
 * erro só aparece quando não há nada para exibir.
 *
 * Importante: `buscar` deve ser estável (useCallback na rota) — o efeito
 * revalida quando a chave ou o fetcher mudarem de identidade.
 */
export function useCache<T>(chave: string, buscar: () => Promise<T>): RetornoUseCache<T> {
  const [estado, setEstado] = useState<EstadoCache<T>>(() => ({
    chave,
    dados: lerCache<T>(chave),
    erro: null,
  }));

  // Troca de chave com o componente montado (ex: filtro do Ranking): serve o
  // cache da nova chave imediatamente; sem cache, mantém os dados antigos na
  // tela (sem skeleton) até a resposta chegar. Padrão "adjust state during
  // render" do React — re-renderiza antes de pintar, sem flash.
  if (estado.chave !== chave) {
    setEstado({ chave, dados: lerCache<T>(chave) ?? estado.dados, erro: null });
  }

  useEffect(() => {
    let ativo = true;

    executar(chave, buscar).then(
      (resultado) => {
        if (ativo) {
          setEstado((anterior) => ({ ...anterior, dados: resultado, erro: null }));
        }
      },
      (motivo) => {
        if (ativo) {
          setEstado((anterior) =>
            anterior.dados === undefined
              ? { ...anterior, erro: formatarMensagemErro(motivo) }
              : anterior
          );
        }
      }
    );

    return () => {
      ativo = false;
    };
  }, [chave, buscar]);

  // Força busca na rede e aguarda a promise resolver (o PullToRefresh depende
  // disso para segurar o indicador até o fim da atualização). Nunca rejeita.
  const recarregar = useCallback(async () => {
    try {
      const resultado = await executar(chave, buscar);
      setEstado((anterior) =>
        anterior.chave === chave ? { ...anterior, dados: resultado, erro: null } : anterior
      );
    } catch (motivo) {
      setEstado((anterior) =>
        anterior.chave === chave && anterior.dados === undefined
          ? { ...anterior, erro: formatarMensagemErro(motivo) }
          : anterior
      );
    }
  }, [chave, buscar]);

  return {
    dados: estado.dados,
    // Skeleton apenas na primeira visita: revalidação em background nunca seta.
    carregando: estado.dados === undefined && estado.erro === null,
    erro: estado.erro,
    recarregar,
  };
}
