const normalizeText = (value: string, maxLength: number) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Za-z0-9 .-]/g, '')
  .toUpperCase()
  .slice(0, maxLength);

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

const crc16 = (payload: string) => {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

export const buildPixPayload = ({
  key,
  recipientName,
  city,
  amount,
  transactionId,
}: {
  key: string;
  recipientName: string;
  city: string;
  amount: number;
  transactionId?: string;
}) => {
  const merchantAccount = field('00', 'BR.GOV.BCB.PIX') + field('01', key.trim());
  const txid = normalizeText(transactionId || 'DOCESDAMARI', 25) || '***';
  const base = [
    field('00', '01'),
    field('26', merchantAccount),
    field('52', '0000'),
    field('53', '986'),
    amount > 0 ? field('54', amount.toFixed(2)) : '',
    field('58', 'BR'),
    field('59', normalizeText(recipientName || 'MARIANE SIMAS', 25)),
    field('60', normalizeText(city || 'SANTANA LIVRAM', 15)),
    field('62', field('05', txid)),
  ].join('');
  const withCrcHeader = `${base}6304`;
  return `${withCrcHeader}${crc16(withCrcHeader)}`;
};
