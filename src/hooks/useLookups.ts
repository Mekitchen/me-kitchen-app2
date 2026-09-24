import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { UomMaster, IngredientCategory, DishCategory, SupplierMaster, KitchenMaster } from '../types/domain'

export function useUoms() {
  return useQuery({
    queryKey: ['uom_master'],
    queryFn: async () => {
      const { data, error } = await supabase.from('uom_master').select('*').order('code')
      if (error) throw error
      return data as UomMaster[]
    },
  })
}

export function useIngredientCategories() {
  return useQuery({
    queryKey: ['ingredient_category'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ingredient_category').select('*').order('name')
      if (error) throw error
      return data as IngredientCategory[]
    },
  })
}

export function useDishCategories() {
  return useQuery({
    queryKey: ['dish_category'],
    queryFn: async () => {
      const { data, error } = await supabase.from('dish_category').select('*').order('name')
      if (error) throw error
      return data as DishCategory[]
    },
  })
}

export function useSuppliers() {
  return useQuery({
    queryKey: ['supplier_master', 'lookup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('supplier_master').select('*').eq('active', true).order('name')
      if (error) throw error
      return data as SupplierMaster[]
    },
  })
}

export function useKitchens() {
  return useQuery({
    queryKey: ['kitchen_master', 'lookup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('kitchen_master').select('*').eq('active', true).order('name')
      if (error) throw error
      return data as KitchenMaster[]
    },
  })
}
