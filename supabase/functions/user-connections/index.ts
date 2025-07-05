import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
}

interface ConnectionRequest {
  action: 'create' | 'update' | 'delete' | 'list';
  fromUserId: string;
  toUserId?: string;
  connectionType?: 'follow' | 'friend' | 'block' | 'match';
  status?: 'pending' | 'accepted' | 'rejected' | 'blocked';
  connectionId?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, fromUserId, toUserId, connectionType, status, connectionId }: ConnectionRequest = await req.json()

    if (!fromUserId) {
      throw new Error('From user ID is required')
    }

    switch (action) {
      case 'create':
        if (!toUserId || !connectionType) {
          throw new Error('To user ID and connection type are required for create action')
        }

        // 检查是否已存在连接
        const { data: existingConnection } = await supabase
          .from('user_connections')
          .select('*')
          .eq('from_user_id', fromUserId)
          .eq('to_user_id', toUserId)
          .eq('connection_type', connectionType)
          .single()

        if (existingConnection) {
          throw new Error('Connection already exists')
        }

        // 创建新连接
        const { data: newConnection, error: createError } = await supabase
          .from('user_connections')
          .insert({
            from_user_id: fromUserId,
            to_user_id: toUserId,
            connection_type: connectionType,
            status: status || 'pending'
          })
          .select()
          .single()

        if (createError) throw createError

        // 记录活动
        await supabase
          .from('community_activities')
          .insert({
            user_id: fromUserId,
            activity_type: 'connection_request',
            target_user_id: toUserId,
            metadata: {
              connection_type: connectionType,
              status: status || 'pending'
            }
          })

        // 如果是好友请求，检查是否互相关注（自动接受）
        if (connectionType === 'friend') {
          const { data: reverseConnection } = await supabase
            .from('user_connections')
            .select('*')
            .eq('from_user_id', toUserId)
            .eq('to_user_id', fromUserId)
            .eq('connection_type', 'friend')
            .single()

          if (reverseConnection) {
            // 自动接受双方的好友请求
            await supabase
              .from('user_connections')
              .update({ status: 'accepted' })
              .eq('id', newConnection.id)

            await supabase
              .from('user_connections')
              .update({ status: 'accepted' })
              .eq('id', reverseConnection.id)
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            connection: newConnection
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )

      case 'update':
        if (!connectionId && !toUserId) {
          throw new Error('Connection ID or to user ID is required for update action')
        }

        let updateQuery = supabase.from('user_connections')

        if (connectionId) {
          updateQuery = updateQuery.eq('id', connectionId)
        } else {
          updateQuery = updateQuery
            .eq('from_user_id', toUserId) // 注意：这里是接收方更新发送方的请求
            .eq('to_user_id', fromUserId)
        }

        const { data: updatedConnection, error: updateError } = await updateQuery
          .update({ status })
          .select()
          .single()

        if (updateError) throw updateError

        // 记录活动
        await supabase
          .from('community_activities')
          .insert({
            user_id: fromUserId,
            activity_type: 'connection_request',
            target_user_id: toUserId,
            metadata: {
              action: 'update',
              new_status: status
            }
          })

        return new Response(
          JSON.stringify({
            success: true,
            connection: updatedConnection
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )

      case 'delete':
        if (!connectionId && !toUserId) {
          throw new Error('Connection ID or to user ID is required for delete action')
        }

        let deleteQuery = supabase.from('user_connections')

        if (connectionId) {
          deleteQuery = deleteQuery.eq('id', connectionId)
        } else {
          deleteQuery = deleteQuery
            .eq('from_user_id', fromUserId)
            .eq('to_user_id', toUserId)
        }

        const { error: deleteError } = await deleteQuery.delete()

        if (deleteError) throw deleteError

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Connection deleted successfully'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )

      case 'list':
        // 获取用户的所有连接
        const { data: connections, error: listError } = await supabase
          .from('user_connections')
          .select(`
            *,
            to_profile:profiles!user_connections_to_user_id_fkey(
              id, nickname, group_nickname, group_identity, profession, 
              specialties, fitness_interests, learning_interests, 
              status, last_active_at, is_verified
            ),
            from_profile:profiles!user_connections_from_user_id_fkey(
              id, nickname, group_nickname, group_identity, profession,
              specialties, fitness_interests, learning_interests,
              status, last_active_at, is_verified
            )
          `)
          .or(`from_user_id.eq.${fromUserId},to_user_id.eq.${fromUserId}`)
          .order('created_at', { ascending: false })

        if (listError) throw listError

        // 分类连接
        const categorizedConnections = {
          sent: connections?.filter(c => c.from_user_id === fromUserId) || [],
          received: connections?.filter(c => c.to_user_id === fromUserId) || [],
          friends: connections?.filter(c => 
            c.connection_type === 'friend' && c.status === 'accepted'
          ) || [],
          followers: connections?.filter(c => 
            c.connection_type === 'follow' && c.to_user_id === fromUserId && c.status === 'accepted'
          ) || [],
          following: connections?.filter(c => 
            c.connection_type === 'follow' && c.from_user_id === fromUserId && c.status === 'accepted'
          ) || [],
          blocked: connections?.filter(c => 
            c.connection_type === 'block' && c.from_user_id === fromUserId
          ) || []
        }

        return new Response(
          JSON.stringify({
            success: true,
            connections: categorizedConnections,
            total: connections?.length || 0
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )

      default:
        throw new Error('Invalid action')
    }

  } catch (error) {
    console.error('User connections error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})