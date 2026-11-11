/**
 * The delivery-address inputs, shared by checkout and the address book on
 * the profile page. The server checks the same rules (utils/address.js).
 */
export const BLANK_ADDRESS = { fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

/** Only the address fields of a saved address (drops _id and isDefault). */
export const pickAddress = (a) => Object.fromEntries(Object.keys(BLANK_ADDRESS).map((k) => [k, a?.[k] || '']));

/** "Priya Sharma, 12 MG Road, Hyderabad 500081" */
export const oneLine = (a) => [a.fullName, a.line1, a.line2, `${a.city} ${a.pincode}`].filter(Boolean).join(', ');

const AddressFields = ({ value, onChange, idPrefix = 'addr' }) => {
  const set = (e) => onChange({ ...value, [e.target.name]: e.target.value });
  const field = (name, label, props = {}) => (
    <div className={props.wide ? 'sm:col-span-2' : ''}>
      <label className="label" htmlFor={`${idPrefix}-${name}`}>{label}</label>
      <input
        id={`${idPrefix}-${name}`}
        name={name}
        value={value[name]}
        onChange={set}
        required={!props.optional}
        inputMode={props.numeric ? 'numeric' : undefined}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        className="field"
      />
    </div>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {field('fullName', 'Full name', { wide: true, maxLength: 100 })}
      {field('phone', 'Mobile number', { wide: true, numeric: true, placeholder: '10 digits', maxLength: 14 })}
      {field('line1', 'Address', { wide: true, maxLength: 200 })}
      {field('line2', 'Apartment, landmark (optional)', { wide: true, optional: true, maxLength: 200 })}
      {field('city', 'City', { maxLength: 100 })}
      {field('state', 'State', { maxLength: 100 })}
      {field('pincode', 'PIN code', { numeric: true, placeholder: '6 digits', maxLength: 6 })}
    </div>
  );
};

export default AddressFields;
