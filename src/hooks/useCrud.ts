import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

/**
 * Generic Supabase-backed CRUD hook for a single table. Covers the master-data
 * modules (kitchens, customers, suppliers, ingredients, dishes) without each
 * page hand-rolling its own fetch/insert/update/delete plumbing.
 */
export function useCrud<T extends { id: string }>(table: string, select = '*', orderBy = 'created_at', ascending = false) {
  const qc = useQueryClient()
  const key = [table, select, orderBy, ascending]

  const list = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select(select).order(orderBy, { ascending })
      if (error) throw error
      return data as unknown as T[]
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: [table] })

  const create = useMutation({
    mutationFn: async (payload: Partial<T>) => {
      const { data, error } = await supabase.from(table).insert(payload as any).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Đã tạo thành công')
      invalidate()
    },
    onError: (e: any) => toast.error(e.message ?? 'Tạo thất bại'),
  })

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<T> }) => {
      const { data, error } = await supabase.from(table).update(payload as any).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Đã lưu')
      invalidate()
    },
    onError: (e: any) => toast.error(e.message ?? 'Cập nhật thất bại'),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Đã xoá')
      invalidate()
    },
    onError: (e: any) => toast.error(e.message ?? 'Xoá thất bại'),
  })

  return { list, create, update, remove, invalidate }
}
