import React, { useState } from 'react';

const Dropdown = ({ options, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}>Dropdown</button>
      {isOpen && (
        <ul>
          {options.map((option, index) => (
            <li key={index} onClick={() => onSelect(option)}>
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Dropdown;