/**
 * app/sumula/[match_id].tsx
 * Task: T6.2 - Tela Sumula pos-jogo (placar + stats + finalizar).
 *
 * Rota fora das tabs (declarada em app/_layout.tsx como Stack screen).
 * Acesso: botao "Sumula" na tela Sorteio (apos draw, status='active')
 * via router.push(`/sumula/${matchId}`). Membros comuns leem stats apenas.
 *
 * Funcionalidades (PT-BR):
 *   - Carrega MATCHES + MATCH_PARTICIPANTS (JOIN profiles) do match.
 *   - Admin edita placar (MATCHES.team_scores): botao +/- por time.
 *   - Admin edita stats por jogador (goals_scored/assisted/own_goals).
 *   - Botao "Finalizar Partida" seta MATCHES.status='finished' e dispara
 *     reminder LOCAL de goleiros no device (T4.3 ja cablado em _layout.tsx
 *     via subscribeMatchesForReminder -> fireGoalkeeperReminderNow).
 *   - Admin: botao "Adicionar jogador" (PRD regra 4 - avulso in-game).
 *
 * Estados: loading inicial, vazio (sem draw), erro PT-BR via Alert.alert.
 *
 * RLS (T1.7):
 *   - MATCHES update: so admin.
 *   - MATCH_PARTICIPANTS update/insert: so admin.
 *   - Leitura: membros do grupo.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button, Card } from '@/components/ui';
import { PlayerStatRow } from '@/components/PlayerStatRow';
import { useProfileStore } from '@/stores/profile';
import { useMatchStore } from '@/stores/match';
import {
  applyStatDelta,
  canFinishMatch,
  fetchMatchSumula,
  finishMatch,
  friendlyError,
  setTeamScore,
  summarizeParticipants,
  updateParticipantStat,
  updateTeamScores,
  addWalkInParticipant,
  type PlayerStatField,
  type SumulaParticipant,
  type TeamScoresMap,
} from '@/lib/sumula';
import type { ProfileRow } from '@/types/database.types';

interface ConfirmButton {
  text: string;
  style?: 'cancel' | 'default' | 'destructive';
  onPress?: () => void;
}

function alertInfo(title: string, msg: string) {
  const buttons: ConfirmButton[] = [{ text: 'OK', style: 'cancel' }];
  Alert.alert(title, msg, buttons);
}

// ---- Componente: stepper de placar por time -------------------------------

function ScoreStepper({
  label,
  colorClass,
  score,
  editable,
  onDelta,
}: {
  label: string;
  colorClass: string;
  score: number;
  editable: boolean;
  onDelta: (delta: number) => void;
}) {
  return (
    <View className="flex-1 items-center gap-1">
      <Text className={`text-center text-base font-bold ${colorClass}`}>{label}</Text>
      <View className="flex-row items-center gap-3">
        {editable ? (
          <Pressable
            onPress={() => onDelta(-1)}
            accessibilityRole="button"
            accessibilityLabel={`Diminuir placar ${label}`}
            disabled={score <= 0}
            className="min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-pitch-100 active:bg-pitch-200"
          >
            <Text className="text-lg font-bold text-pitch-900">&minus;</Text>
          </Pressable>
        ) : null}
        <Text className="min-w-[40px] text-center text-3xl font-bold text-pitch-900">{score}</Text>
        {editable ? (
          <Pressable
            onPress={() => onDelta(+1)}
            accessibilityRole="button"
            accessibilityLabel={`Aumentar placar ${label}`}
            className="min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-field active:bg-field-dark"
          >
            <Text className="text-lg font-bold text-white">+</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ---- Modal: Adicionar jogador (PRD regra 4) --------------------------------

interface WalkInResult {
  playerId: string;
  teamGroup: number;
  displayName: string;
}

/**
 * Modal simples para o admin escolher um jogador do grupo que NAO esta
 * nos MATCH_PARTICIPANTS (avulso nao-confirmado que compareceu em campo).
 *
 * Estado local controlado pelo parent (visible + lista candidatos).
 */
function WalkInModal({
  visible,
  candidates,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  candidates: ProfileRow[];
  onClose: () => void;
  onConfirm: (result: WalkInResult) => void;
}) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [teamGroup, setTeamGroup] = useState<number>(1);

  useEffect(() => {
    if (visible) {
      setPlayerId(null);
      setTeamGroup(1);
    }
  }, [visible]);

  const submit = () => {
    if (!playerId) {
      alertInfo('Selecionar jogador', 'Escolha um jogador da lista.');
      return;
    }
    const picked = candidates.find((c) => c.id === playerId);
    if (!picked) return;
    onConfirm({
      playerId,
      teamGroup,
      displayName: picked.full_name,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/40 p-4">
        <View className="w-full max-w-md rounded-2xl bg-white p-4">
          <Text className="mb-3 text-lg font-bold text-pitch-900">Adicionar jogador</Text>
          <Text className="mb-2 text-xs text-pitch-600">
            Avulso nao-confirmado que compareceu em campo (regra 4).
          </Text>

          {candidates.length === 0 ? (
            <Text className="my-3 text-sm text-pitch-500">
              Nenhum candidato disponivel (todos ja estao na sumula).
            </Text>
          ) : (
            <>
              <Text className="mb-1 mt-2 text-xs font-semibold uppercase text-pitch-500">
                Jogador
              </Text>
              <ScrollView className="max-h-[200px]">
                {candidates.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setPlayerId(c.id)}
                    className={`min-h-[44px] flex-row items-center justify-between rounded-md border px-3 py-2 ${
                      playerId === c.id ? 'border-field bg-field/10' : 'border-pitch-200 bg-white'
                    }`}
                  >
                    <Text className="flex-1 text-sm font-medium text-pitch-900">{c.full_name}</Text>
                    <Text className="text-[10px] font-semibold uppercase text-pitch-500">
                      {c.user_type}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text className="mb-1 mt-3 text-xs font-semibold uppercase text-pitch-500">Time</Text>
              <View className="flex-row gap-2">
                {[1, 2].map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setTeamGroup(t)}
                    className={`min-h-[44px] flex-1 items-center justify-center rounded-md border ${
                      teamGroup === t ? 'border-field bg-field/10' : 'border-pitch-200 bg-white'
                    }`}
                  >
                    <Text className="text-sm font-semibold text-pitch-900">Time {t}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <View className="mt-4 flex-row justify-end gap-2">
            <Button title="Cancelar" onPress={onClose} variant="secondary" />
            <Button title="Adicionar" onPress={submit} disabled={candidates.length === 0} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---- Tela ------------------------------------------------------------------

export default function SumulaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ match_id: string }>();
  const matchId = Array.isArray(params.match_id) ? params.match_id[0] : params.match_id;

  const currentProfile = useProfileStore((s) => s.currentProfile);
  const isAdmin = Boolean(currentProfile?.is_admin);

  const match = useMatchStore((s) => s.match);
  const teamScores = useMatchStore((s) => s.teamScores);
  const participants = useMatchStore((s) => s.sumulaParticipants);
  const loading = useMatchStore((s) => s.sumulaLoading);
  const error = useMatchStore((s) => s.sumulaError);
  const setSumulaSnapshot = useMatchStore((s) => s.setSumulaSnapshot);
  const setSumulaLoading = useMatchStore((s) => s.setSumulaLoading);
  const setSumulaError = useMatchStore((s) => s.setSumulaError);
  const patchTeamScore = useMatchStore((s) => s.patchTeamScore);
  const patchParticipantStat = useMatchStore((s) => s.patchParticipantStat);
  const upsertSumulaParticipant = useMatchStore((s) => s.upsertSumulaParticipant);
  const setMatchStatus = useMatchStore((s) => s.setMatchStatus);

  const [savingScore, setSavingScore] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [groupProfiles, setGroupProfiles] = useState<ProfileRow[]>([]);

  const refresh = useCallback(async () => {
    if (!matchId) return;
    setSumulaLoading(true);
    setSumulaError(null);
    try {
      const result = await fetchMatchSumula(matchId);
      if (!result) {
        setSumulaError('Partida nao encontrada.');
        return;
      }
      setSumulaSnapshot(result);
    } catch (e) {
      setSumulaError(e instanceof Error ? e.message : String(e));
    } finally {
      setSumulaLoading(false);
    }
  }, [matchId, setSumulaSnapshot, setSumulaLoading, setSumulaError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ---- Handlers -------------------------------------------------------------

  const handleScoreDelta = useCallback(
    (teamGroup: number, delta: number) => {
      const current = Number(teamScores[String(teamGroup)] ?? 0);
      const nextValue = Math.max(0, current + delta);
      // Optimistic local
      patchTeamScore(teamGroup, nextValue);

      // Persiste snapshot do map no DB (debounce simples por chamada - YAGNI).
      void (async () => {
        try {
          setSavingScore(true);
          const nextMap: TeamScoresMap = setTeamScore(teamScores, teamGroup, nextValue);
          await updateTeamScores(matchId, nextMap);
        } catch (e) {
          const msg = e instanceof Error ? e.message : friendlyError(null);
          // Rollback local p/ versao do DB no proximo refresh.
          alertInfo('Erro ao salvar placar', msg);
          void refresh();
        } finally {
          setSavingScore(false);
        }
      })();
    },
    [matchId, teamScores, patchTeamScore, refresh],
  );

  const handleStatChange = useCallback(
    (participant: SumulaParticipant) => (field: PlayerStatField, delta: number) => {
      const nextValue = applyStatDelta(participant[field], delta);
      // Optimistic local
      patchParticipantStat(participant.id, field, nextValue);

      void (async () => {
        try {
          await updateParticipantStat(participant.id, field, nextValue);
        } catch (e) {
          const msg = e instanceof Error ? e.message : friendlyError(null);
          alertInfo('Erro ao salvar estatistica', msg);
          void refresh();
        }
      })();
    },
    [patchParticipantStat, refresh],
  );

  const handleFinish = useCallback(() => {
    if (!match) return;
    Alert.alert(
      'Finalizar partida',
      'Finalizar a partida agora? O status sera definido como finalizou e sera gerado o lembrete de goleiros para o admin.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'default',
          onPress: async () => {
            setFinishing(true);
            try {
              await finishMatch(match.id, match.status);
              // Otimismo local + aviso explicito ao admin (T4.3 dispara reminder
              // via Realtime no device admin, ja cablado em app/(tabs)/_layout.tsx).
              setMatchStatus('finished');
              alertInfo(
                'Partida finalizada',
                'Status atualizado. O lembrete de goleiros sera disparado no dispositivo do administrador.',
              );
            } catch (e) {
              const msg = e instanceof Error ? e.message : friendlyError(null);
              alertInfo('Erro ao finalizar', msg);
            } finally {
              setFinishing(false);
            }
          },
        },
      ],
    );
  }, [match, setMatchStatus]);

  const handleOpenWalkIn = useCallback(async () => {
    if (!match) return;
    // Carrega PROFILES do grupo do match (RLS leitura p/ membros).
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('group_id', match.group_id)
        .order('full_name', { ascending: true });
      if (pErr) throw new Error(friendlyError(pErr as { code?: string }));
      const all = (data ?? []) as unknown as ProfileRow[];
      // Exclui quem ja esta na sumula.
      const inSumula = new Set(participants.map((p) => p.player_id));
      const candidates = all.filter((p) => !inSumula.has(p.id));
      setGroupProfiles(candidates);
      setWalkInOpen(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : friendlyError(null);
      alertInfo('Erro ao carregar jogadores', msg);
    }
    Keyboard.dismiss();
  }, [match, participants]);

  const handleWalkInConfirm = useCallback(
    async (result: WalkInResult) => {
      if (!match) return;
      setWalkInOpen(false);
      try {
        const inserted = await addWalkInParticipant({
          matchId: match.id,
          playerId: result.playerId,
          teamGroup: result.teamGroup,
        });
        const enriched: SumulaParticipant = {
          ...inserted,
          full_name: result.displayName,
          // user_type ja inferido do DB via JOIN; p/ imediato uso placeholder.
          user_type: 'avulso',
        };
        upsertSumulaParticipant(enriched);
        alertInfo('Jogador adicionado', `${result.displayName} no time ${result.teamGroup}.`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : friendlyError(null);
        alertInfo('Erro ao adicionar', msg);
      }
    },
    [match, upsertSumulaParticipant],
  );

  // ---- Derived --------------------------------------------------------------

  const summary = useMemo(() => summarizeParticipants(participants), [participants]);

  const team1 = useMemo(() => participants.filter((p) => p.team_group === 1), [participants]);
  const team2 = useMemo(() => participants.filter((p) => p.team_group === 2), [participants]);

  const score1 = Number(teamScores['1'] ?? 0);
  const score2 = Number(teamScores['2'] ?? 0);
  const matchStatus = match?.status;
  const canFinish = canFinishMatch(matchStatus);
  const isFinished = matchStatus === 'finished';

  // ---- Render ---------------------------------------------------------------

  if (loading && !match) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-pitch-50">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-pitch-50">
      <ScrollView contentContainerClassName="gap-3 p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-pitch-900">Sumula</Text>
          {savingScore ? <Text className="text-xs text-pitch-500">Salvando placar...</Text> : null}
        </View>

        {error ? (
          <Card>
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-sm text-danger">{error}</Text>
              <Pressable onPress={() => void refresh()}>
                <Text className="text-sm font-semibold text-field-dark">Tentar novamente</Text>
              </Pressable>
            </View>
          </Card>
        ) : null}

        {match ? (
          <Card>
            <Text className="text-base font-semibold text-pitch-900">Placar</Text>
            <Text className="mt-1 text-xs text-pitch-600">
              Edite o placar com os botoes. Cada alteracao e salva automaticamente.
            </Text>
            <View className="mt-3 flex-row gap-3">
              <ScoreStepper
                label={`Time 1`}
                colorClass="text-field-dark"
                score={score1}
                editable={isAdmin && !isFinished}
                onDelta={(d) => handleScoreDelta(1, d)}
              />
              <View className="w-px bg-pitch-200" />
              <ScoreStepper
                label="Time 2"
                colorClass="text-goalkeeper"
                score={score2}
                editable={isAdmin && !isFinished}
                onDelta={(d) => handleScoreDelta(2, d)}
              />
            </View>
            <View className="mt-3 flex-row gap-4">
              <Text className="flex-1 text-xs text-pitch-500">
                Gols somados time 1:{' '}
                <Text className="font-bold text-pitch-900">
                  {Number(summary.totalGoals['1'] ?? 0)}
                </Text>
              </Text>
              <Text className="flex-1 text-xs text-pitch-500">
                Gols somado time 2:{' '}
                <Text className="font-bold text-pitch-900">
                  {Number(summary.totalGoals['2'] ?? 0)}
                </Text>
              </Text>
            </View>
          </Card>
        ) : null}

        {match && isAdmin && !isFinished ? (
          <Card>
            <Text className="text-base font-semibold text-pitch-900">Jogadores em campo</Text>
            <Text className="mt-1 text-xs text-pitch-600">
              {participants.length} participantes. Edite gols / assistencias / gols contra por
              jogador.
            </Text>
            {isAdmin ? (
              <View className="mt-3">
                <Button title="Adicionar jogador" onPress={handleOpenWalkIn} variant="secondary" />
              </View>
            ) : null}
          </Card>
        ) : null}

        <View className="gap-2">
          <Text className="px-1 text-sm font-bold text-field-dark">Time 1</Text>
          {team1.length === 0 ? (
            <Text className="px-1 text-sm text-pitch-500">Sem jogadores no time 1.</Text>
          ) : (
            team1.map((p) => (
              <PlayerStatRow
                key={p.id}
                fullName={p.full_name}
                teamGroup={1}
                isGoalkeeper={p.is_goalkeeper}
                goalsScored={p.goals_scored}
                goalsAssisted={p.goals_assisted}
                ownGoals={p.own_goals}
                onStatChange={isAdmin && !isFinished ? handleStatChange(p) : undefined}
              />
            ))
          )}
        </View>

        <View className="gap-2">
          <Text className="px-1 text-sm font-bold text-goalkeeper">Time 2</Text>
          {team2.length === 0 ? (
            <Text className="px-1 text-sm text-pitch-500">Sem jogadores no time 2.</Text>
          ) : (
            team2.map((p) => (
              <PlayerStatRow
                key={p.id}
                fullName={p.full_name}
                teamGroup={2}
                isGoalkeeper={p.is_goalkeeper}
                goalsScored={p.goals_scored}
                goalsAssisted={p.goals_assisted}
                ownGoals={p.own_goals}
                onStatChange={isAdmin && !isFinished ? handleStatChange(p) : undefined}
              />
            ))
          )}
        </View>

        {match && isAdmin && canFinish ? (
          <Card>
            <Text className="text-base font-semibold text-pitch-900">Encerramento</Text>
            <Text className="mt-1 text-xs text-pitch-600">
              Finalizar gera lembrete de goleiros (R$ {Number(match.goalkeeper_expense).toFixed(2)})
              no device do administrador.
            </Text>
            <View className="mt-3">
              <Button
                title={finishing ? 'Finalizando...' : 'Finalizar Partida'}
                onPress={handleFinish}
                loading={finishing}
                disabled={finishing}
                variant="danger"
              />
            </View>
          </Card>
        ) : null}

        {isFinished ? (
          <Card>
            <Text className="text-base font-semibold text-pitch-900">Partida finalizada</Text>
            <Text className="mt-1 text-xs text-pitch-600">
              Sumula em modo leitura. Para alterar, reinicie a partida pelo admin.
            </Text>
          </Card>
        ) : null}

        <View className="h-2" />
      </ScrollView>

      <View className="border-t border-pitch-200 bg-white p-3">
        <Button title="Voltar" onPress={() => router.back()} variant="secondary" />
      </View>

      <WalkInModal
        visible={walkInOpen}
        candidates={groupProfiles}
        onClose={() => setWalkInOpen(false)}
        onConfirm={handleWalkInConfirm}
      />
    </SafeAreaView>
  );
}
