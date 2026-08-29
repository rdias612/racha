export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.15';
  };
  public: {
    Tables: {
      cron_execucoes: {
        Row: {
          erro: string | null;
          executado_em: string;
          id: number;
          job_nome: string;
          resposta: string | null;
          status_code: number | null;
          sucesso: boolean;
        };
        Insert: {
          erro?: string | null;
          executado_em?: string;
          id?: number;
          job_nome: string;
          resposta?: string | null;
          status_code?: number | null;
          sucesso?: boolean;
        };
        Update: {
          erro?: string | null;
          executado_em?: string;
          id?: number;
          job_nome?: string;
          resposta?: string | null;
          status_code?: number | null;
          sucesso?: boolean;
        };
        Relationships: [];
      };
      dividas: {
        Row: {
          created_at: string;
          data_divida: string;
          data_pagamento: string | null;
          descricao: string | null;
          evento_automatico_id: number | null;
          id: number;
          jogador_id: number | null;
          natureza: string;
          paga: boolean;
          partida_id: number | null;
          referencia: string | null;
          tipo: string;
          valor: number;
        };
        Insert: {
          created_at?: string;
          data_divida?: string;
          data_pagamento?: string | null;
          descricao?: string | null;
          evento_automatico_id?: number | null;
          id?: number;
          jogador_id?: number | null;
          natureza?: string;
          paga?: boolean;
          partida_id?: number | null;
          referencia?: string | null;
          tipo: string;
          valor: number;
        };
        Update: {
          created_at?: string;
          data_divida?: string;
          data_pagamento?: string | null;
          descricao?: string | null;
          evento_automatico_id?: number | null;
          id?: number;
          jogador_id?: number | null;
          natureza?: string;
          paga?: boolean;
          partida_id?: number | null;
          referencia?: string | null;
          tipo?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'dividas_evento_automatico_id_fkey';
            columns: ['evento_automatico_id'];
            isOneToOne: false;
            referencedRelation: 'eventos_financeiros_automaticos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dividas_jogador_id_fkey';
            columns: ['jogador_id'];
            isOneToOne: false;
            referencedRelation: 'dividas_resumo';
            referencedColumns: ['jogador_id'];
          },
          {
            foreignKeyName: 'dividas_jogador_id_fkey';
            columns: ['jogador_id'];
            isOneToOne: false;
            referencedRelation: 'jogadores';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dividas_partida_id_fkey';
            columns: ['partida_id'];
            isOneToOne: false;
            referencedRelation: 'partida_placar';
            referencedColumns: ['partida_id'];
          },
          {
            foreignKeyName: 'dividas_partida_id_fkey';
            columns: ['partida_id'];
            isOneToOne: false;
            referencedRelation: 'partidas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dividas_partida_id_fkey';
            columns: ['partida_id'];
            isOneToOne: false;
            referencedRelation: 'partidas_com_placar';
            referencedColumns: ['id'];
          },
        ];
      };
      eventos_financeiros_automaticos: {
        Row: {
          ativo: boolean;
          created_at: string;
          descricao_template: string;
          destino: string;
          gatilho: string;
          id: number;
          jogador_id: number | null;
          natureza: string;
          nome: string;
          referencia_template: string | null;
          tipo: string;
          valor: number;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          descricao_template: string;
          destino: string;
          gatilho: string;
          id?: number;
          jogador_id?: number | null;
          natureza: string;
          nome: string;
          referencia_template?: string | null;
          tipo: string;
          valor: number;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          descricao_template?: string;
          destino?: string;
          gatilho?: string;
          id?: number;
          jogador_id?: number | null;
          natureza?: string;
          nome?: string;
          referencia_template?: string | null;
          tipo?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'eventos_financeiros_automaticos_jogador_id_fkey';
            columns: ['jogador_id'];
            isOneToOne: false;
            referencedRelation: 'dividas_resumo';
            referencedColumns: ['jogador_id'];
          },
          {
            foreignKeyName: 'eventos_financeiros_automaticos_jogador_id_fkey';
            columns: ['jogador_id'];
            isOneToOne: false;
            referencedRelation: 'jogadores';
            referencedColumns: ['id'];
          },
        ];
      };
      jogadores: {
        Row: {
          chave_pix: string | null;
          created_at: string;
          id: number;
          is_admin: boolean;
          is_ativo: boolean;
          is_mensalista: boolean;
          posicao: string;
          posicao_b: string | null;
          senha_hash: string;
          telefone: string | null;
          username: string;
        };
        Insert: {
          chave_pix?: string | null;
          created_at?: string;
          id?: number;
          is_admin?: boolean;
          is_ativo?: boolean;
          is_mensalista?: boolean;
          posicao: string;
          posicao_b?: string | null;
          senha_hash: string;
          telefone?: string | null;
          username: string;
        };
        Update: {
          chave_pix?: string | null;
          created_at?: string;
          id?: number;
          is_admin?: boolean;
          is_ativo?: boolean;
          is_mensalista?: boolean;
          posicao?: string;
          posicao_b?: string | null;
          senha_hash?: string;
          telefone?: string | null;
          username?: string;
        };
        Relationships: [];
      };
      notificacoes_config: {
        Row: {
          confirmacao_ativo: boolean;
          confirmacao_dia_semana: number;
          confirmacao_horario: string;
          confirmacao_mensagem: string | null;
          confirmacao_titulo: string | null;
          id: number;
          reforco_ativo: boolean;
          reforco_horas_antes_prazo: number;
          reforco_mensagem: string | null;
          reforco_titulo: string | null;
          updated_at: string;
          updated_by: number | null;
          votacao_abertura_ativo: boolean;
          votacao_ativo: boolean;
          votacao_bucket_1h: boolean;
          votacao_bucket_30m: boolean;
          votacao_bucket_3h: boolean;
          votacao_bucket_6h: boolean;
          votacao_template_1h_msg: string | null;
          votacao_template_1h_titulo: string | null;
          votacao_template_30m_msg: string | null;
          votacao_template_30m_titulo: string | null;
          votacao_template_3h_msg: string | null;
          votacao_template_3h_titulo: string | null;
          votacao_template_6h_msg: string | null;
          votacao_template_6h_titulo: string | null;
          votacao_template_abertura_msg: string | null;
          votacao_template_abertura_titulo: string | null;
        };
        Insert: {
          confirmacao_ativo?: boolean;
          confirmacao_dia_semana?: number;
          confirmacao_horario?: string;
          confirmacao_mensagem?: string | null;
          confirmacao_titulo?: string | null;
          id?: number;
          reforco_ativo?: boolean;
          reforco_horas_antes_prazo?: number;
          reforco_mensagem?: string | null;
          reforco_titulo?: string | null;
          updated_at?: string;
          updated_by?: number | null;
          votacao_abertura_ativo?: boolean;
          votacao_ativo?: boolean;
          votacao_bucket_1h?: boolean;
          votacao_bucket_30m?: boolean;
          votacao_bucket_3h?: boolean;
          votacao_bucket_6h?: boolean;
          votacao_template_1h_msg?: string | null;
          votacao_template_1h_titulo?: string | null;
          votacao_template_30m_msg?: string | null;
          votacao_template_30m_titulo?: string | null;
          votacao_template_3h_msg?: string | null;
          votacao_template_3h_titulo?: string | null;
          votacao_template_6h_msg?: string | null;
          votacao_template_6h_titulo?: string | null;
          votacao_template_abertura_msg?: string | null;
          votacao_template_abertura_titulo?: string | null;
        };
        Update: {
          confirmacao_ativo?: boolean;
          confirmacao_dia_semana?: number;
          confirmacao_horario?: string;
          confirmacao_mensagem?: string | null;
          confirmacao_titulo?: string | null;
          id?: number;
          reforco_ativo?: boolean;
          reforco_horas_antes_prazo?: number;
          reforco_mensagem?: string | null;
          reforco_titulo?: string | null;
          updated_at?: string;
          updated_by?: number | null;
          votacao_abertura_ativo?: boolean;
          votacao_ativo?: boolean;
          votacao_bucket_1h?: boolean;
          votacao_bucket_30m?: boolean;
          votacao_bucket_3h?: boolean;
          votacao_bucket_6h?: boolean;
          votacao_template_1h_msg?: string | null;
          votacao_template_1h_titulo?: string | null;
          votacao_template_30m_msg?: string | null;
          votacao_template_30m_titulo?: string | null;
          votacao_template_3h_msg?: string | null;
          votacao_template_3h_titulo?: string | null;
          votacao_template_6h_msg?: string | null;
          votacao_template_6h_titulo?: string | null;
          votacao_template_abertura_msg?: string | null;
          votacao_template_abertura_titulo?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'notificacoes_config_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'dividas_resumo';
            referencedColumns: ['jogador_id'];
          },
          {
            foreignKeyName: 'notificacoes_config_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'jogadores';
            referencedColumns: ['id'];
          },
        ];
      };
      partida_eventos: {
        Row: {
          assistencia_jogador_id: number | null;
          created_at: string;
          id: number;
          jogador_id: number;
          partida_id: number;
          tipo: string;
        };
        Insert: {
          assistencia_jogador_id?: number | null;
          created_at?: string;
          id?: number;
          jogador_id: number;
          partida_id: number;
          tipo: string;
        };
        Update: {
          assistencia_jogador_id?: number | null;
          created_at?: string;
          id?: number;
          jogador_id?: number;
          partida_id?: number;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'partida_eventos_assistencia_jogador_id_fkey';
            columns: ['assistencia_jogador_id'];
            isOneToOne: false;
            referencedRelation: 'dividas_resumo';
            referencedColumns: ['jogador_id'];
          },
          {
            foreignKeyName: 'partida_eventos_assistencia_jogador_id_fkey';
            columns: ['assistencia_jogador_id'];
            isOneToOne: false;
            referencedRelation: 'jogadores';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'partida_eventos_jogador_id_fkey';
            columns: ['jogador_id'];
            isOneToOne: false;
            referencedRelation: 'dividas_resumo';
            referencedColumns: ['jogador_id'];
          },
          {
            foreignKeyName: 'partida_eventos_jogador_id_fkey';
            columns: ['jogador_id'];
            isOneToOne: false;
            referencedRelation: 'jogadores';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'partida_eventos_partida_id_fkey';
            columns: ['partida_id'];
            isOneToOne: false;
            referencedRelation: 'partida_placar';
            referencedColumns: ['partida_id'];
          },
          {
            foreignKeyName: 'partida_eventos_partida_id_fkey';
            columns: ['partida_id'];
            isOneToOne: false;
            referencedRelation: 'partidas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'partida_eventos_partida_id_fkey';
            columns: ['partida_id'];
            isOneToOne: false;
            referencedRelation: 'partidas_com_placar';
            referencedColumns: ['id'];
          },
        ];
      };
      partidas: {
        Row: {
          confirmacao_closes_at: string | null;
          created_at: string;
          criado_por: number;
          data_jogo: string;
          id: number;
          status: string;
          voting_closes_at: string | null;
        };
        Insert: {
          confirmacao_closes_at?: string | null;
          created_at?: string;
          criado_por: number;
          data_jogo: string;
          id?: number;
          status?: string;
          voting_closes_at?: string | null;
        };
        Update: {
          confirmacao_closes_at?: string | null;
          created_at?: string;
          criado_por?: number;
          data_jogo?: string;
          id?: number;
          status?: string;
          voting_closes_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'partidas_criado_por_fkey';
            columns: ['criado_por'];
            isOneToOne: false;
            referencedRelation: 'dividas_resumo';
            referencedColumns: ['jogador_id'];
          },
          {
            foreignKeyName: 'partidas_criado_por_fkey';
            columns: ['criado_por'];
            isOneToOne: false;
            referencedRelation: 'jogadores';
            referencedColumns: ['id'];
          },
        ];
      };
      partidas_participantes: {
        Row: {
          assistencias: number;
          confirmado_em: string | null;
          gols: number;
          gols_contra: number;
          jogador_id: number;
          partida_id: number;
          posicao: string;
          status_confirmacao: string;
          time: string | null;
        };
        Insert: {
          assistencias?: number;
          confirmado_em?: string | null;
          gols?: number;
          gols_contra?: number;
          jogador_id: number;
          partida_id: number;
          posicao: string;
          status_confirmacao?: string;
          time?: string | null;
        };
        Update: {
          assistencias?: number;
          confirmado_em?: string | null;
          gols?: number;
          gols_contra?: number;
          jogador_id?: number;
          partida_id?: number;
          posicao?: string;
          status_confirmacao?: string;
          time?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'partidas_participantes_jogador_id_fkey';
            columns: ['jogador_id'];
            isOneToOne: false;
            referencedRelation: 'dividas_resumo';
            referencedColumns: ['jogador_id'];
          },
          {
            foreignKeyName: 'partidas_participantes_jogador_id_fkey';
            columns: ['jogador_id'];
            isOneToOne: false;
            referencedRelation: 'jogadores';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'partidas_participantes_partida_id_fkey';
            columns: ['partida_id'];
            isOneToOne: false;
            referencedRelation: 'partida_placar';
            referencedColumns: ['partida_id'];
          },
          {
            foreignKeyName: 'partidas_participantes_partida_id_fkey';
            columns: ['partida_id'];
            isOneToOne: false;
            referencedRelation: 'partidas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'partidas_participantes_partida_id_fkey';
            columns: ['partida_id'];
            isOneToOne: false;
            referencedRelation: 'partidas_com_placar';
            referencedColumns: ['id'];
          },
        ];
      };
      push_reminder_deliveries: {
        Row: {
          claimed_at: string;
          error_message: string | null;
          jogador_id: number;
          partida_id: number;
          reminder_key: string;
          sent_at: string | null;
        };
        Insert: {
          claimed_at?: string;
          error_message?: string | null;
          jogador_id: number;
          partida_id: number;
          reminder_key: string;
          sent_at?: string | null;
        };
        Update: {
          claimed_at?: string;
          error_message?: string | null;
          jogador_id?: number;
          partida_id?: number;
          reminder_key?: string;
          sent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'push_reminder_deliveries_jogador_id_fkey';
            columns: ['jogador_id'];
            isOneToOne: false;
            referencedRelation: 'dividas_resumo';
            referencedColumns: ['jogador_id'];
          },
          {
            foreignKeyName: 'push_reminder_deliveries_jogador_id_fkey';
            columns: ['jogador_id'];
            isOneToOne: false;
            referencedRelation: 'jogadores';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'push_reminder_deliveries_partida_id_fkey';
            columns: ['partida_id'];
            isOneToOne: false;
            referencedRelation: 'partida_placar';
            referencedColumns: ['partida_id'];
          },
          {
            foreignKeyName: 'push_reminder_deliveries_partida_id_fkey';
            columns: ['partida_id'];
            isOneToOne: false;
            referencedRelation: 'partidas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'push_reminder_deliveries_partida_id_fkey';
            columns: ['partida_id'];
            isOneToOne: false;
            referencedRelation: 'partidas_com_placar';
            referencedColumns: ['id'];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: number;
          jogador_id: number;
          p256dh: string;
          updated_at: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: number;
          jogador_id: number;
          p256dh: string;
          updated_at?: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: number;
          jogador_id?: number;
          p256dh?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_jogador_id_fkey';
            columns: ['jogador_id'];
            isOneToOne: false;
            referencedRelation: 'dividas_resumo';
            referencedColumns: ['jogador_id'];
          },
          {
            foreignKeyName: 'push_subscriptions_jogador_id_fkey';
            columns: ['jogador_id'];
            isOneToOne: false;
            referencedRelation: 'jogadores';
            referencedColumns: ['id'];
          },
        ];
      };
      votes: {
        Row: {
          created_at: string;
          id: number;
          partida_id: number;
          rating: number;
          target_id: number;
          voter_id: number;
        };
        Insert: {
          created_at?: string;
          id?: number;
          partida_id: number;
          rating: number;
          target_id: number;
          voter_id: number;
        };
        Update: {
          created_at?: string;
          id?: number;
          partida_id?: number;
          rating?: number;
          target_id?: number;
          voter_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'votes_partida_id_fkey';
            columns: ['partida_id'];
            isOneToOne: false;
            referencedRelation: 'partida_placar';
            referencedColumns: ['partida_id'];
          },
          {
            foreignKeyName: 'votes_partida_id_fkey';
            columns: ['partida_id'];
            isOneToOne: false;
            referencedRelation: 'partidas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'votes_partida_id_fkey';
            columns: ['partida_id'];
            isOneToOne: false;
            referencedRelation: 'partidas_com_placar';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'votes_target_id_fkey';
            columns: ['target_id'];
            isOneToOne: false;
            referencedRelation: 'dividas_resumo';
            referencedColumns: ['jogador_id'];
          },
          {
            foreignKeyName: 'votes_target_id_fkey';
            columns: ['target_id'];
            isOneToOne: false;
            referencedRelation: 'jogadores';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'votes_voter_id_fkey';
            columns: ['voter_id'];
            isOneToOne: false;
            referencedRelation: 'dividas_resumo';
            referencedColumns: ['jogador_id'];
          },
          {
            foreignKeyName: 'votes_voter_id_fkey';
            columns: ['voter_id'];
            isOneToOne: false;
            referencedRelation: 'jogadores';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      dividas_resumo: {
        Row: {
          is_mensalista: boolean | null;
          jogador_id: number | null;
          qtd_dividas: number | null;
          total_devido: number | null;
          username: string | null;
        };
        Relationships: [];
      };
      partida_notas: {
        Row: {
          avg_rating: number | null;
          is_craque: boolean | null;
          partida_id: number | null;
          target_id: number | null;
          username: string | null;
          vote_count: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'votes_partida_id_fkey';
            columns: ['partida_id'];
            isOneToOne: false;
            referencedRelation: 'partida_placar';
            referencedColumns: ['partida_id'];
          },
          {
            foreignKeyName: 'votes_partida_id_fkey';
            columns: ['partida_id'];
            isOneToOne: false;
            referencedRelation: 'partidas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'votes_partida_id_fkey';
            columns: ['partida_id'];
            isOneToOne: false;
            referencedRelation: 'partidas_com_placar';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'votes_target_id_fkey';
            columns: ['target_id'];
            isOneToOne: false;
            referencedRelation: 'dividas_resumo';
            referencedColumns: ['jogador_id'];
          },
          {
            foreignKeyName: 'votes_target_id_fkey';
            columns: ['target_id'];
            isOneToOne: false;
            referencedRelation: 'jogadores';
            referencedColumns: ['id'];
          },
        ];
      };
      partida_placar: {
        Row: {
          gols_time_a: number | null;
          gols_time_b: number | null;
          partida_id: number | null;
          vencedor: string | null;
        };
        Relationships: [];
      };
      partidas_com_placar: {
        Row: {
          data_jogo: string | null;
          gols_time_a: number | null;
          gols_time_b: number | null;
          id: number | null;
          status: string | null;
        };
        Relationships: [];
      };
      ranking: {
        Row: {
          assistencias: number | null;
          derrotas: number | null;
          empates: number | null;
          gols: number | null;
          gols_contra: number | null;
          jogador_id: number | null;
          partidas: number | null;
          pontos: number | null;
          posicao: string | null;
          username: string | null;
          vitorias: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'partidas_participantes_jogador_id_fkey';
            columns: ['jogador_id'];
            isOneToOne: false;
            referencedRelation: 'dividas_resumo';
            referencedColumns: ['jogador_id'];
          },
          {
            foreignKeyName: 'partidas_participantes_jogador_id_fkey';
            columns: ['jogador_id'];
            isOneToOne: false;
            referencedRelation: 'jogadores';
            referencedColumns: ['id'];
          },
        ];
      };
      stats_jogador: {
        Row: {
          assistencias: number | null;
          gols: number | null;
          gols_contra: number | null;
          jogador_id: number | null;
          partidas: number | null;
          vitorias: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'partidas_participantes_jogador_id_fkey';
            columns: ['jogador_id'];
            isOneToOne: false;
            referencedRelation: 'dividas_resumo';
            referencedColumns: ['jogador_id'];
          },
          {
            foreignKeyName: 'partidas_participantes_jogador_id_fkey';
            columns: ['jogador_id'];
            isOneToOne: false;
            referencedRelation: 'jogadores';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      abrir_partida: {
        Args: { p_admin_id?: number; p_partida_id: number };
        Returns: boolean;
      };
      adicionar_participante: {
        Args: { p_jogador_id: number; p_partida_id: number };
        Returns: boolean;
      };
      admin_definir_confirmacao: {
        Args: {
          p_admin_id: number;
          p_jogador_id: number;
          p_partida_id: number;
          p_status: string;
        };
        Returns: boolean;
      };
      alterar_username: {
        Args: { p_jogador_id: number; p_novo_username: string };
        Returns: boolean;
      };
      alternar_status_ativo_jogador: {
        Args: { p_admin_id: number; p_is_ativo: boolean; p_jogador_id: number };
        Returns: boolean;
      };
      atualizar_dados_pix_telefone: {
        Args: {
          p_chave_pix?: string | null;
          p_jogador_id: number;
          p_operador_id: number;
          p_telefone?: string | null;
        };
        Returns: boolean;
      };
      confirmar_presenca: {
        Args: { p_jogador_id: number; p_partida_id: number; p_status: string };
        Returns: boolean;
      };
      confronto_direto: {
        Args: { p_jogador_a: number; p_jogador_b: number };
        Returns: {
          assistencias: number;
          bloco: string;
          derrotas: number;
          empates: number;
          gols: number;
          gols_contra: number;
          lado: string;
          media_nota: number;
          partidas: number;
          vitorias: number;
        }[];
      };
      confronto_direto_partidas: {
        Args: { p_jogador_a: number; p_jogador_b: number; p_limite?: number };
        Returns: {
          data_jogo: string;
          gols_time_a: number;
          gols_time_b: number;
          partida_id: number;
          relacao: string;
          time_a: string;
          vencedor: string;
        }[];
      };
      criar_goleiro_rapido:
        | {
            Args: { p_chave_pix?: string; p_nome: string; p_telefone?: string };
            Returns: number;
          }
        | {
            Args: {
              p_admin_id?: number;
              p_chave_pix?: string;
              p_nome: string;
              p_telefone?: string;
            };
            Returns: number;
          };
      criar_jogador: {
        Args: {
          p_is_admin: boolean;
          p_is_mensalista?: boolean;
          p_posicao: string;
          p_posicao_b?: string;
          p_username: string;
        };
        Returns: number;
      };
      criar_partida: {
        Args: {
          p_criado_por: number;
          p_data_jogo: string;
          p_participantes: Json;
        };
        Returns: number;
      };
      criar_partida_semanal_mensalistas: { Args: never; Returns: number };
      descartar_votos: {
        Args: { p_partida_id: number; p_voter_id: number };
        Returns: boolean;
      };
      disparar_confirmacao_manual: {
        Args: { p_admin_id: number; p_partida_id: number };
        Returns: boolean;
      };
      disparar_push_teste: { Args: { p_admin_id: number }; Returns: boolean };
      disparar_push_votacao_aberta: {
        Args: { p_admin_id: number; p_partida_id: number };
        Returns: boolean;
      };
      editar_evento: {
        Args: {
          p_assistencia_jogador_id?: number;
          p_evento_id: number;
          p_jogador_id: number;
          p_tipo: string;
        };
        Returns: boolean;
      };
      excluir_partida: {
        Args: { p_admin_id: number; p_partida_id: number };
        Returns: boolean;
      };
      fazer_login: {
        Args: { p_senha: string; p_username: string };
        Returns: {
          id: number;
          is_admin: boolean;
          is_ativo: boolean;
          is_mensalista: boolean;
          posicao: string;
          posicao_b: string;
          username: string;
        }[];
      };
      finalizar_partida: { Args: { p_partida_id: number }; Returns: boolean };
      gerar_avulsos_partida: {
        Args: { p_partida_id: number };
        Returns: undefined;
      };
      gerar_lancamentos_fim_partida: {
        Args: { p_partida_id: number };
        Returns: undefined;
      };
      gerar_lancamentos_mensais: { Args: never; Returns: undefined };
      listar_pendentes_votacao_abertura: {
        Args: { p_partida_id: number };
        Returns: {
          partida_id: number;
          jogador_id: number;
          voting_closes_at: string;
          subscriptions: Json;
        }[];
      };
      obter_configuracoes_notificacoes: {
        Args: { p_admin_id: number };
        Returns: Json;
      };
      obter_medias_notas_jogadores: {
        Args: never;
        Returns: {
          jogador_id: number;
          media_nota: number;
        }[];
      };
      obter_painel_entregas_push: {
        Args: { p_admin_id: number; p_limite?: number };
        Returns: {
          jogador_id: number;
          username: string;
          is_mensalista: boolean;
          posicao: string;
          qtd_aparelhos: number;
          primeira_inscricao_em: string | null;
          ultima_inscricao_em: string | null;
          aparelhos: Json;
          total_entregas: number;
          ultima_entrega_em: string | null;
          ultima_entrega_key: string | null;
          ultima_entrega_partida: number | null;
          total_erros: number;
          ultimo_erro: string | null;
          ultimo_erro_em: string | null;
        }[];
      };
      obter_partidas_recentes_jogadores: {
        Args: { p_meses?: number };
        Returns: {
          jogador_id: number;
          partidas_recentes: number;
        }[];
      };
      parcerias_destaque_jogador: {
        Args: { p_jogador_id: number; p_min_partidas?: number };
        Returns: {
          metrica: string;
          outro_jogador_id: number;
          partidas: number;
          username: string;
          valor: number;
        }[];
      };
      parcerias_jogador: {
        Args: { p_jogador_id: number; p_min_partidas?: number };
        Returns: {
          derrotas: number;
          empates: number;
          outro_jogador_id: number;
          partidas: number;
          percentual: number;
          pontos: number;
          tipo: string;
          username: string;
          vitorias: number;
        }[];
      };
      pares_racha: {
        Args: { p_min_partidas?: number };
        Returns: {
          derrotas: number;
          empates: number;
          jogador_a_id: number;
          jogador_a_username: string;
          jogador_b_id: number;
          jogador_b_username: string;
          partidas: number;
          percentual: number;
          pontos: number;
          vitorias: number;
        }[];
      };
      publicar_partida: { Args: { p_partida_id: number }; Returns: boolean };
      quitar_divida: { Args: { p_divida_id: number }; Returns: undefined };
      quitar_dividas_jogador: {
        Args: { p_jogador_id: number };
        Returns: undefined;
      };
      registrar_divida: {
        Args: {
          p_data_divida?: string | null;
          p_descricao?: string | null;
          p_jogador_id?: number | null;
          p_natureza?: string | null;
          p_partida_id?: number | null;
          p_referencia?: string | null;
          p_tipo: string;
          p_valor: number;
        };
        Returns: number;
      };
      registrar_evento: {
        Args: {
          p_assistencia_jogador_id?: number;
          p_jogador_id: number;
          p_partida_id: number;
          p_tipo: string;
        };
        Returns: number;
      };
      registrar_votos: {
        Args: { p_partida_id: number; p_voter_id: number; p_votos: Json };
        Returns: boolean;
      };
      remover_evento: { Args: { p_evento_id: number }; Returns: boolean };
      resetar_senha: { Args: { p_jogador_id: number }; Returns: boolean };
      resumo_ano: {
        Args: { p_ano: number };
        Returns: {
          ano: number;
          artilheiro_gols: number;
          artilheiro_jogador_id: number;
          artilheiro_partidas: number;
          artilheiro_username: string;
          eficiente_jogador_id: number;
          eficiente_partidas: number;
          eficiente_percentual: number;
          eficiente_username: string;
          eficiente_vitorias: number;
          maestro_assistencias: number;
          maestro_jogador_id: number;
          maestro_partidas: number;
          maestro_username: string;
          participante_jogador_id: number;
          participante_partidas: number;
          participante_username: string;
          seca_vitorias: number;
          seca_vitorias_jogador_id: number;
          seca_vitorias_username: string;
          sequencia_vitorias: number;
          sequencia_vitorias_jogador_id: number;
          sequencia_vitorias_username: string;
          total_partidas: number;
        }[];
      };
      salvar_caracteristicas_jogadores: {
        Args: { p_admin_id: number; p_jogadores: Json };
        Returns: boolean;
      };
      salvar_configuracoes_notificacoes: {
        Args: { p_admin_id: number; p_config: Json };
        Returns: boolean;
      };
      salvar_edicao_partida: {
        Args: {
          p_participantes: Json;
          p_partida_id: number;
          p_primeira_vez?: boolean;
        };
        Returns: boolean;
      };
      salvar_times_e_goleiros_partida:
        | {
            Args: {
              p_goleiro_a_id: number;
              p_goleiro_b_id: number;
              p_partida_id: number;
              p_times_linha: Json;
            };
            Returns: boolean;
          }
        | {
            Args: {
              p_admin_id?: number;
              p_goleiro_a_id: number;
              p_goleiro_b_id: number;
              p_partida_id: number;
              p_times_linha: Json;
            };
            Returns: boolean;
          };
      sincronizar_contadores_partida: {
        Args: { p_partida_id: number };
        Returns: undefined;
      };
      substituir_template_financeiro: {
        Args: { p_data: string; p_nome?: string; p_template: string };
        Returns: string;
      };
      trocar_senha: {
        Args: {
          p_jogador_id: number;
          p_senha_atual: string;
          p_senha_nova: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
