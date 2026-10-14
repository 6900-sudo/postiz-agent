import { PostizAPI } from '../api';
import { getConfig } from '../config';
import { exit } from 'node:process';

interface CommandArgs extends Record<string, unknown> {
  group?: string;
  id?: string;
  method?: string;
  data?: string;
}

export async function listIntegrations(args: CommandArgs) {
  const config = getConfig();
  const api = new PostizAPI(config);

  try {
    const result = await api.listIntegrations(args?.group);
    console.log('🔌 Connected Integrations:');
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('❌ Failed to list integrations:', error instanceof Error ? error.message : String(error));
    exit(1);
  }
}

export async function listGroups() {
  const config = getConfig();
  const api = new PostizAPI(config);

  try {
    const result = await api.listGroups();
    console.log('👥 Groups (Customers):');
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('❌ Failed to list groups:', error instanceof Error ? error.message : String(error));
    exit(1);
  }
}

export async function getIntegrationSettings(args: CommandArgs) {
  const config = getConfig();
  const api = new PostizAPI(config);

  if (!args.id) {
    console.error('❌ Integration ID is required');
    exit(1);
  }

  try {
    const result = await api.getIntegrationSettings(args.id as string);
    console.log(`⚙️  Settings for integration: ${args.id}`);
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('❌ Failed to get integration settings:', error instanceof Error ? error.message : String(error));
    exit(1);
  }
}

export async function triggerIntegrationTool(args: CommandArgs) {
  const config = getConfig();
  const api = new PostizAPI(config);

  if (!args.id) {
    console.error('❌ Integration ID is required');
    exit(1);
  }

  if (!args.method) {
    console.error('❌ Method name is required');
    exit(1);
  }

  // Parse data from JSON string or use empty object
  let data: Record<string, string> = {};
  if (args.data) {
    try {
      data = JSON.parse(args.data as string);
    } catch (error) {
      console.error('❌ Failed to parse data JSON:', error instanceof Error ? error.message : String(error));
      exit(1);
    }
  }

  try {
    const result = await api.triggerIntegrationTool(args.id as string, args.method as string, data);
    console.log(`🔧 Tool result for ${args.method}:`);
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('❌ Failed to trigger tool:', error instanceof Error ? error.message : String(error));
    exit(1);
  }
}
