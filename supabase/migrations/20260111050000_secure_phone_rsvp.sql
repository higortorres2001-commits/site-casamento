-- Computed column to check if whatsapp exists without revealing it
create or replace function has_whatsapp(guest_row guests)
returns boolean as $$
  select guest_row.whatsapp is not null and length(trim(guest_row.whatsapp)) > 0;
$$ language sql stable security definer;

-- RPC to verify identity and retrieve phone if correct
create or replace function verify_guest_identity(p_guest_id uuid, p_last_4 text)
returns json as $$
declare
  v_phone text;
  v_clean_phone text;
begin
  select whatsapp into v_phone from guests where id = p_guest_id;
  
  if v_phone is null or length(trim(v_phone)) = 0 then
    -- If no phone set, return success but null phone (shouldn't strictly happen if UI checked has_whatsapp)
    return json_build_object('valid', true, 'phone', null);
  end if;

  -- Normalize phone (remove non-digits)
  v_clean_phone := regexp_replace(v_phone, '\D','','g');
  
  -- Check last 4 digits
  if right(v_clean_phone, 4) = p_last_4 then
    return json_build_object('valid', true, 'phone', v_phone);
  else
    return json_build_object('valid', false, 'phone', null);
  end if;
end;
$$ language plpgsql security definer;
