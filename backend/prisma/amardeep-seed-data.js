export const societyName = 'Amardeep Apartment';
export const password = 'Pass@123';

const residentsByWing = {
  A: [
    { apartment: 'A-11', name: 'Aarav Sharma' },
    { apartment: 'A-2', name: 'Priya Verma' },
    { apartment: 'A-3', name: 'Rohan Mehta' },
    { apartment: 'A-4', name: 'Ananya Gupta' },
    { apartment: 'A-5', name: 'Vikram Shah' },
    { apartment: 'A-6', name: 'Neha Patel' }
  ],
  B: [
    { apartment: 'B-1', name: 'Arjun Rao' },
    { apartment: 'B-2', name: 'Kavya Iyer' },
    { apartment: 'B-3', name: 'Siddharth Nair' },
    { apartment: 'B-4', name: 'Ishita Joshi' },
    { apartment: 'B-5', name: 'Aditya Kulkarni' },
    { apartment: 'B-6', name: 'Meera Desai' },
    { apartment: 'B-7', name: 'Rahul Chatterjee' },
    { apartment: 'B-8', name: 'Pooja Reddy' },
    { apartment: 'B-9', name: 'Karan Malhotra' },
    { apartment: 'B-10', name: 'Sneha Banerjee' },
    { apartment: 'B-11', name: 'Nikhil Sinha' },
    { apartment: 'B-12', name: 'Divya Menon' },
    { apartment: 'B-13', name: 'Manish Yadav' },
    { apartment: 'B-14', name: 'Tanvi Kapoor' }
  ],
  C: [
    { apartment: 'C-1', name: 'Devansh Mishra' },
    { apartment: 'C-2', name: 'Ritika Das' },
    { apartment: 'C-3', name: 'Harsh Vora' },
    { apartment: 'C-4', name: 'Simran Kaur' },
    { apartment: 'C-5', name: 'Pranav Bhat' },
    { apartment: 'C-6', name: 'Aditi Saxena' },
    { apartment: 'C-7', name: 'Mohit Arora' },
    { apartment: 'C-8', name: 'Nandini Pillai' }
  ]
};

const residents = Object.values(residentsByWing).flatMap((wingResidents) =>
  wingResidents.map(({ apartment, name }) => ({
    apartment,
    email: `${apartment.replace('-', '').toLowerCase()}@amardeep.com`,
    name,
    role: 'RESIDENT',
    title: 'Resident'
  }))
);

const administrators = [
  { email: 'chairperson@amardeep.com', name: 'Sanjay Deshmukh', title: 'Chairperson' },
  { email: 'secretary@amardeep.com', name: 'Kavita Nair', title: 'Secretary' },
  { email: 'cashier@amardeep.com', name: 'Rajesh Iyer', title: 'Cashier' }
].map((administrator) => ({
  ...administrator,
  apartment: '',
  role: 'ADMIN'
}));

export const accounts = [...residents, ...administrators];
