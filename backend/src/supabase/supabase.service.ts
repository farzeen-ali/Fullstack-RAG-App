import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EnvironmentVariables } from '../config/env.validation';

@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient<any, any>;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.client = createClient(
      config.get('SUPABASE_URL', { infer: true }),
      config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true }),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
  }
}
